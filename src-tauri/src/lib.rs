use serde_json::Value;

const CLIENT_ID: &str = "861556708454-d6dlm3lh05idd8npek18k6be8ba3oc68.apps.googleusercontent.com";
const CLIENT_SECRET: &str = "S0s1102oihRVAHCnVUvmLqPB";
const SCOPE: &str = "https://www.googleapis.com/auth/youtube";

#[tauri::command]
async fn get_device_code() -> Result<Value, String> {
    let client = reqwest::Client::new();
    client.post("https://oauth2.googleapis.com/device/code")
        .form(&[
            ("client_id", CLIENT_ID),
            ("scope", SCOPE),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn poll_token(device_code: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    client.post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", CLIENT_ID),
            ("client_secret", CLIENT_SECRET),
            ("device_code", device_code.as_str()),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn refresh_token(refresh_token: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    client.post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", CLIENT_ID),
            ("client_secret", CLIENT_SECRET),
            ("refresh_token", refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ytmusic_request(endpoint: &str, body: Value, token: &str) -> Result<Value, String> {
    let url = format!("https://music.youtube.com/youtubei/v1/{}?prettyPrint=false", endpoint);
    let client = reqwest::Client::new();
    client.post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_device_code, 
            poll_token, 
            refresh_token, 
            ytmusic_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
