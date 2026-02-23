import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-opener";

const authStatus = document.getElementById("auth-status")!;
const authContainer = document.getElementById("auth-container")!;
const musicContainer = document.getElementById("music-container")!;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const authStep2 = document.getElementById("auth-step-2")!;
const verificationUrlEl = document.getElementById("verification-url") as HTMLAnchorElement;
const userCodeEl = document.getElementById("user-code")!;

const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchBtn = document.getElementById("search-btn") as HTMLButtonElement;
const resultsGrid = document.getElementById("results")!;

let accessToken = localStorage.getItem("ytm_access_token");
let refreshToken = localStorage.getItem("ytm_refresh_token");

async function init() {
  if (accessToken && refreshToken) {
    showMusicApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  authContainer.classList.remove("hidden");
  musicContainer.classList.add("hidden");
  authStatus.textContent = "Not logged in";
}

function showMusicApp() {
  authContainer.classList.add("hidden");
  musicContainer.classList.remove("hidden");
  authStatus.textContent = "Logged In";
}

loginBtn.addEventListener("click", async () => {
  loginBtn.disabled = true;
  try {
    const codeData: any = await invoke("get_device_code");
    
    authStep2.classList.remove("hidden");
    const vUrl = codeData.verification_url + "?userCode=" + codeData.user_code;
    verificationUrlEl.textContent = vUrl;
    verificationUrlEl.href = '#';
    verificationUrlEl.onclick = async (e) => {
        e.preventDefault();
        await open(vUrl);
    };
    userCodeEl.textContent = codeData.user_code;
    
    try {
        await open(vUrl);
    } catch(e) { console.error('auto open failed', e); }

    const interval = (codeData.interval || 5) * 1000;
    
    let pending = true;
    while(pending) {
       await new Promise(r => setTimeout(r, interval));
       try {
           const res: any = await invoke("poll_token", { deviceCode: codeData.device_code });
           if (res.error === "authorization_pending") {
              continue; // wait more
           } else if (res.access_token) {
              accessToken = res.access_token;
              refreshToken = res.refresh_token;
              localStorage.setItem("ytm_access_token", accessToken!);
              localStorage.setItem("ytm_refresh_token", refreshToken!);
              pending = false;
              showMusicApp();
           } else if (res.error) {
              console.error("Auth error", res);
              alert("Wait failed: " + res.error);
              pending = false;
           }
       } catch(e) {
           console.error("Poll request failed:", e);
           pending = false;
       }
    }
  } catch (error) {
    console.error("Login Error:", error);
    alert("An error occurred during log in.");
    authStep2.classList.add("hidden");
  } finally {
    loginBtn.disabled = false;
  }
});

searchBtn.addEventListener("click", async () => {
  const query = searchInput.value.trim();
  if (!query) return;

  resultsGrid.innerHTML = `<div class="loader">Searching...</div>`;

  try {
    if (!accessToken) throw new Error("No access token!");

    let ytmResponse: any = await requestYTMusic("search", {
      context: {
        client: {
          clientName: "WEB_REMIX",
          clientVersion: "1.20230508.01.00",
          hl: "en",
          gl: "US"
        }
      },
      query: query
    });

    if (ytmResponse.error && ytmResponse.error.code === 401) {
      const refreshData: any = await invoke("refresh_token", { refreshToken });
      if (refreshData.access_token) {
        accessToken = refreshData.access_token;
        localStorage.setItem("ytm_access_token", accessToken!);
        
        ytmResponse = await requestYTMusic("search", {
          context: {
            client: {
              clientName: "WEB_REMIX",
              clientVersion: "1.20230508.01.00"
            }
          },
          query: query
        });
      }
    }

    renderResults(ytmResponse);
  } catch (err) {
    console.error("Search error", err);
    resultsGrid.innerHTML = `<div>Error performing search</div>`;
  }
});

async function requestYTMusic(endpoint: string, body: any) {
  return await invoke("ytmusic_request", {
    endpoint,
    body,
    token: accessToken
  });
}

function renderResults(res: any) {
  resultsGrid.innerHTML = "";
  
  try {
    let sections = res?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
    if (!sections) {
      resultsGrid.innerHTML = "No results found or different response layout.";
      return;
    }
    
    let songsToRender: any[] = [];
    
    for (const section of sections) {
        if (section.musicShelfRenderer) {
             const shelf = section.musicShelfRenderer;
             for (const item of shelf.contents) {
                 if (item.musicResponsiveListItemRenderer) {
                     songsToRender.push(item.musicResponsiveListItemRenderer);
                 }
             }
        }
    }

    if (songsToRender.length === 0) {
      resultsGrid.innerHTML = "No music items found for query.";
      return;
    }

    songsToRender.forEach(song => {
       const flexCols = song.flexColumns;
       if (!flexCols || flexCols.length < 2) return;
       
       const titleObj = flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0];
       const artistObj = flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0];
       
       const title = titleObj ? titleObj.text : "Unknown Title";
       const artist = artistObj ? artistObj.text : "Unknown Artist";
       
       const thumbObj = song.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
       const thumbUrl = thumbObj && thumbObj.length > 0 ? thumbObj[thumbObj.length - 1].url : 'https://placehold.co/400x225/1e293b/ffffff?text=No+Cover';
       
       const el = document.createElement("div");
       el.className = "song-card";
       el.innerHTML = `
          <img src="${thumbUrl}" class="song-thumbnail" alt="${title}" />
          <div class="song-info">
             <h4 class="song-title">${title}</h4>
             <p class="song-artist">${artist}</p>
          </div>
       `;
       resultsGrid.appendChild(el);
    });

  } catch(e) {
    console.error("Parse error", e);
    resultsGrid.innerHTML = "Error parsing results.";
  }
}

init();
