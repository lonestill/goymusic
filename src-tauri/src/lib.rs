use serde_json::Value;
use std::sync::Mutex;
use tauri::State;
use std::sync::Arc;

/// Percent-encode a string for safe embedding in JS
fn urlencoding(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(b as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", b));
            }
        }
    }
    result
}

struct AppState {
    /// Port of the local bridge HTTP server
    bridge_port: u16,
    /// Latest response from the webview  
    bridge_response: Arc<Mutex<Option<String>>>,
    /// Signal that a response is ready
    bridge_ready: Arc<Mutex<bool>>,
}

/// Start a tiny HTTP server that receives responses from the webview
fn start_bridge_server() -> (u16, Arc<Mutex<Option<String>>>, Arc<Mutex<bool>>) {
    use std::io::{Read, Write};
    use std::net::TcpListener;
    
    let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind bridge server");
    let port = listener.local_addr().unwrap().port();
    eprintln!("Bridge server on port {}", port);
    
    let response = Arc::new(Mutex::new(None::<String>));
    let ready = Arc::new(Mutex::new(false));
    
    let resp_clone = response.clone();
    let ready_clone = ready.clone();
    
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let mut buf = vec![0u8; 1024 * 512]; // 512KB buffer
                let mut total = 0;
                
                // Read the full HTTP request
                loop {
                    match stream.read(&mut buf[total..]) {
                        Ok(0) => break,
                        Ok(n) => {
                            total += n;
                            // Check if we've received the full request
                            let data = std::str::from_utf8(&buf[..total]).unwrap_or("");
                            if let Some(header_end) = data.find("\r\n\r\n") {
                                // Parse content-length
                                let headers = &data[..header_end];
                                let content_length = headers.lines()
                                    .find(|l| l.to_lowercase().starts_with("content-length:"))
                                    .and_then(|l| l.split(':').nth(1))
                                    .and_then(|v| v.trim().parse::<usize>().ok())
                                    .unwrap_or(0);
                                
                                let body_start = header_end + 4;
                                let body_received = total - body_start;
                                
                                if body_received >= content_length {
                                    // Full body received
                                    let body = &data[body_start..body_start + content_length];
                                    *resp_clone.lock().unwrap() = Some(body.to_string());
                                    *ready_clone.lock().unwrap() = true;
                                    break;
                                }
                                
                                // Need more data - resize buffer if needed
                                if total + 65536 > buf.len() {
                                    buf.resize(buf.len() + 1024 * 512, 0);
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
                
                // Send CORS-friendly response
                let response = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nContent-Length: 2\r\n\r\nok";
                stream.write_all(response.as_bytes()).ok();
            }
        }
    });
    
    (port, response, ready)
}

/// Get the bridge port so the frontend knows where to POST
#[tauri::command]
fn get_bridge_port(state: State<'_, AppState>) -> u16 {
    state.bridge_port
}

/// Make an innertube API request via the webview
#[tauri::command]
async fn ytm_webview_request(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    endpoint: String,
    body_json: String,
) -> Result<Value, String> {
    use tauri::Manager;
    
    let win = app.get_webview_window("ytm-login")
        .ok_or("Login window not found. Please sign in first.")?;
    
    let port = state.bridge_port;
    
    // Reset bridge state
    *state.bridge_response.lock().unwrap() = None;
    *state.bridge_ready.lock().unwrap() = false;
    
    let js = format!(r#"
        (async () => {{
            try {{
                const body = JSON.parse(decodeURIComponent('{body_encoded}'));
                const resp = await fetch('/youtubei/v1/{endpoint}?alt=json&prettyPrint=false&key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    credentials: 'include',
                    body: JSON.stringify(body)
                }});
                const text = await resp.text();
                
                await fetch('http://127.0.0.1:{port}/response', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    body: text
                }});
            }} catch(e) {{
                await fetch('http://127.0.0.1:{port}/response', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify({{ __error: e.message }})
                }});
            }}
        }})();
    "#,
        endpoint = endpoint,
        body_encoded = urlencoding(&body_json),
        port = port
    );
    
    win.eval(&js).map_err(|e| format!("eval error: {}", e))?;
    
    // Wait for response from bridge
    for _ in 0..60 {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        if *state.bridge_ready.lock().unwrap() {
            let resp = state.bridge_response.lock().unwrap().take()
                .ok_or("No response data")?;
            *state.bridge_ready.lock().unwrap() = false;
            
            // Check for error
            if resp.contains("\"__error\"") {
                if let Ok(v) = serde_json::from_str::<Value>(&resp) {
                    if let Some(err) = v.get("__error").and_then(|e| e.as_str()) {
                        return Err(format!("Webview error: {}", err));
                    }
                }
            }
            
            return serde_json::from_str(&resp)
                .map_err(|e| format!("JSON parse error: {}", e));
        }
    }
    
    Err("Timeout waiting for webview response (15s)".to_string())
}

/// Navigate webview and scrape DOM
#[tauri::command]
async fn ytm_scrape(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    url: String,
    scraper_js: String,
) -> Result<Value, String> {
    use tauri::Manager;
    
    let win = app.get_webview_window("ytm-login")
        .ok_or("Login window not found. Please sign in first.")?;
    
    let port = state.bridge_port;
    
    // Navigate to the page
    win.eval(&format!("window.location.href = '{}';", url))
        .map_err(|e| format!("nav eval error: {}", e))?;
    
    // Wait for page to load
    tokio::time::sleep(std::time::Duration::from_secs(4)).await;
    
    // Reset bridge
    *state.bridge_response.lock().unwrap() = None;
    *state.bridge_ready.lock().unwrap() = false;
    
    // Run scraper and POST result to bridge
    let js = format!(r#"
        (async () => {{
            try {{
                const result = await (async () => {{ {scraper_js} }})();
                await fetch('http://127.0.0.1:{port}/response', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify(result)
                }});
            }} catch(e) {{
                await fetch('http://127.0.0.1:{port}/response', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify({{ __error: e.message }})
                }});
            }}
        }})();
    "#, scraper_js = scraper_js, port = port);
    
    win.eval(&js).map_err(|e| format!("scrape eval error: {}", e))?;
    
    // Wait for response
    for _ in 0..40 {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        if *state.bridge_ready.lock().unwrap() {
            let resp = state.bridge_response.lock().unwrap().take()
                .ok_or("No response data")?;
            *state.bridge_ready.lock().unwrap() = false;
            
            if resp.contains("\"__error\"") {
                if let Ok(v) = serde_json::from_str::<Value>(&resp) {
                    if let Some(err) = v.get("__error").and_then(|e| e.as_str()) {
                        return Err(format!("Scraper error: {}", err));
                    }
                }
            }
            
            return serde_json::from_str(&resp)
                .map_err(|e| format!("Scrape JSON error: {}", e));
        }
    }
    
    Err("Timeout waiting for scraper (10s)".to_string())
}

/// Open YouTube Music login window
#[tauri::command]
async fn open_ytm_login(app: tauri::AppHandle, login_mode: Option<bool>) -> Result<bool, String> {
    use tauri::Manager;
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;
    
    if let Some(win) = app.get_webview_window("ytm-login") {
        win.show().ok();
        return Ok(true);
    }
    
    let url = if login_mode.unwrap_or(false) {
        "https://accounts.google.com/ServiceLogin?continue=https://music.youtube.com"
    } else {
        "https://music.youtube.com"
    };
    
    eprintln!("Opening YTM webview: {}", url);
    
    WebviewWindowBuilder::new(
        &app,
        "ytm-login",
        WebviewUrl::External(url.parse().unwrap()),
    )
    .initialization_script(r#"
        // Completely neutralize any attempt to add a beforeunload handler
        const originalAddEventListener = window.addEventListener;
        window.addEventListener = function(type, listener, options) {
            if (type === 'beforeunload' || type === 'unload') return;
            return originalAddEventListener.call(this, type, listener, options);
        };
        Object.defineProperty(window, 'onbeforeunload', {
            set: function() {},
            get: function() { return null; }
        });
    "#)
    .title("Login to YouTube Music")
    .inner_size(500.0, 700.0)
    .build()
    .map_err(|e| e.to_string())?;
    
    Ok(true)
}/// Play a track by video ID
#[tauri::command]
async fn ytm_play_track(app: tauri::AppHandle, video_id: String) -> Result<bool, String> {
    use tauri::Manager;
    let win = app.get_webview_window("ytm-login")
        .ok_or("Login window not found")?;
    
    // Direct navigation is safe now because beforeunload is blocked by the init script
    let js = format!("window.location.replace('https://music.youtube.com/watch?v={}');", video_id);
    win.eval(&js).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Toggle play/pause
#[tauri::command]
async fn ytm_toggle_play(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri::Manager;
    let win = app.get_webview_window("ytm-login")
        .ok_or("Login window not found")?;
    
    win.eval("document.querySelector('video')?.paused ? document.querySelector('video')?.play() : document.querySelector('video')?.pause();")
        .map_err(|e| e.to_string())?;
    Ok(true)
}

/// Seek to position
#[tauri::command]
async fn ytm_seek(app: tauri::AppHandle, time: f64) -> Result<bool, String> {
    use tauri::Manager;
    let win = app.get_webview_window("ytm-login")
        .ok_or("Login window not found")?;
    
    win.eval(&format!("if(document.querySelector('video')) document.querySelector('video').currentTime = {};", time))
        .map_err(|e| e.to_string())?;
    Ok(true)
}

/// Set volume (0-100)
#[tauri::command]
async fn ytm_set_volume(app: tauri::AppHandle, volume: f64) -> Result<bool, String> {
    use tauri::Manager;
    let win = app.get_webview_window("ytm-login")
        .ok_or("Login window not found")?;
    
    win.eval(&format!("if(document.querySelector('video')) document.querySelector('video').volume = {};", volume / 100.0))
        .map_err(|e| e.to_string())?;
    Ok(true)
}

/// Get playback state via bridge
#[tauri::command]
async fn ytm_get_playback_state(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    use tauri::Manager;
    use serde_json::json;
    
    let win = match app.get_webview_window("ytm-login") {
        Some(w) => w,
        None => return Ok(json!(null)),
    };
    
    let port = state.bridge_port;
    *state.bridge_response.lock().unwrap() = None;
    *state.bridge_ready.lock().unwrap() = false;
    
    let js = format!(r#"
        (async () => {{
            const v = document.querySelector('video');
            if (v) {{
                await fetch('http://127.0.0.1:{}/response', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify({{
                        current_time: v.currentTime,
                        duration: v.duration || 0,
                        is_playing: !v.paused
                    }})
                }});
            }}
        }})();
    "#, port);
    
    win.eval(&js).map_err(|e| e.to_string())?;
    
    // Quick poll — 2 seconds max
    for _ in 0..8 {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        if *state.bridge_ready.lock().unwrap() {
            let resp = state.bridge_response.lock().unwrap().take();
            *state.bridge_ready.lock().unwrap() = false;
            if let Some(r) = resp {
                return serde_json::from_str(&r).map_err(|e| e.to_string());
            }
        }
    }
    
    Ok(json!(null))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (port, response, ready) = start_bridge_server();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            bridge_port: port,
            bridge_response: response,
            bridge_ready: ready,
        })
        .invoke_handler(tauri::generate_handler![
            get_bridge_port,
            open_ytm_login,
            ytm_webview_request,
            ytm_scrape,
            ytm_play_track,
            ytm_toggle_play,
            ytm_seek,
            ytm_set_volume,
            ytm_get_playback_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
