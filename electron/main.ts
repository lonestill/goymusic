import { app, BrowserWindow, ipcMain, shell, session } from 'electron'
import { join, dirname } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { writeFileSync } from 'fs'

process.env.DIST = join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(__dirname, '../public')

let win: BrowserWindow | null
let pyProc: ChildProcess | null

function createPyProc() {
  const root = process.cwd()
  const pythonPath = join(root, 'venv/Scripts/python.exe')
  const scriptPath = join(root, 'python/api.py')
  
  pyProc = spawn(pythonPath, [scriptPath], {
    cwd: root,
    env: { 
      ...process.env, 
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8' 
    }
  })
  
  if (pyProc != null) {
    let buffer = ''
    pyProc.stdout?.on('data', (data) => {
      buffer += data.toString()
      let lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line.trim())
          if (msg.event) {
            win?.webContents.send('py:event', msg)
          }
        } catch (e) { }
      }
    })

    pyProc.stderr?.on('data', (data) => {
      console.error(`Python Error: ${data.toString()}`)
    })
  }
}

function exitPyProc() {
  if (pyProc != null) {
    pyProc.kill()
    pyProc = null
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 700,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      webSecurity: false // Necessary for some media requests
    },
  })

  // Filter for both imagery and video playback domains
  const filter = {
    urls: [
      '*://*.googleusercontent.com/*',
      '*://*.ggpht.com/*',
      '*://*.googlevideo.com/*'
    ]
  }

  // Handle outgoing headers
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    details.requestHeaders['Referer'] = 'https://music.youtube.com/'
    details.requestHeaders['Origin'] = 'https://music.youtube.com'
    callback({ requestHeaders: details.requestHeaders })
  })

  // Handle incoming headers (Inject CORS)
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = details.responseHeaders || {}
    responseHeaders['Access-Control-Allow-Origin'] = ['*']
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS']
    responseHeaders['Access-Control-Allow-Headers'] = ['Content-Type, Range, Authorization']
    responseHeaders['Access-Control-Expose-Headers'] = ['Content-Length, Content-Range']
    callback({ responseHeaders })
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(join(process.env.DIST!, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createPyProc()
  createWindow()
})

app.on('will-quit', exitPyProc)

// IPC bridge for Python
ipcMain.handle('py:call', async (event, command, args = {}) => {
  return new Promise((resolve, reject) => {
    if (!pyProc || !pyProc.stdin || !pyProc.stdout) {
      reject('Python process not available')
      return
    }

    const callId = args.callId || Math.random().toString(36).substring(7);

    const timeout = setTimeout(() => {
      pyProc?.stdout?.removeListener('data', onData)
      reject(`Python call timeout: ${command} (${callId})`)
    }, 30000)

    let buffer = ''
    const onData = (data: Buffer) => {
      buffer += data.toString()
      let lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const response = JSON.parse(line.trim())
          // Correlation check: ensure this response matches our specific callId
          if (response.callId === callId) {
            clearTimeout(timeout)
            pyProc?.stdout?.removeListener('data', onData)
            resolve(response)
            return
          }
        } catch (err) { }
      }
    }

    pyProc.stdout.on('data', onData)
    pyProc.stdin.write(JSON.stringify({ command, ...args, callId }) + '\n')
  })
})

// Interactive Login Helper
ipcMain.handle('auth:start', async () => {
  const loginWin = new BrowserWindow({
    width: 800,
    height: 700,
    title: 'Sign in to YouTube Music',
    autoHideMenuBar: true
  })

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  loginWin.webContents.setUserAgent(userAgent)
  loginWin.loadURL('https://music.youtube.com/')

  return new Promise((resolve) => {
    let captured = false

    const filter = {
      urls: ['https://music.youtube.com/youtubei/v1/*']
    }

    loginWin.webContents.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
      if (!captured) {
        const headers = details.requestHeaders
        const auth = headers['Authorization'] || headers['authorization']
        const cookie = headers['Cookie'] || headers['cookie']
        
        // Only capture when we have the actual signed-in auth token
        if (auth && auth.startsWith('SAPISIDHASH') && cookie) {
          captured = true
          
          // Exactly as per ytmusicapi docs
          const browserData = {
            "User-Agent": userAgent,
            "Accept": headers['Accept'] || headers['accept'] || "*/*",
            "Accept-Language": headers['Accept-Language'] || headers['accept-language'] || "en-US,en;q=0.9",
            "Content-Type": headers['Content-Type'] || headers['content-type'] || "application/json",
            "X-Goog-AuthUser": headers['X-Goog-AuthUser'] || headers['x-goog-authuser'] || "0",
            "x-origin": "https://music.youtube.com",
            "Cookie": cookie,
            "Authorization": auth
          }

          try {
            const path = join(process.cwd(), 'browser.json')
            writeFileSync(path, JSON.stringify(browserData, null, 4))
            
            win?.webContents.send('py:event', { event: 'auth_complete' })
            
            setTimeout(() => {
              if (!loginWin.isDestroyed()) loginWin.close()
            }, 1000)
            
            resolve({ status: 'ok' })
          } catch (e) {
            resolve({ status: 'error', message: 'Failed to save credentials' })
          }
        }
      }
      callback({ requestHeaders: details.requestHeaders })
    })

    loginWin.on('closed', () => {
      if (!captured) resolve({ status: 'cancelled' })
    })
  })
})

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url)
})

ipcMain.on('win:minimize', () => win?.minimize())
ipcMain.on('win:maximize', () => {
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})
ipcMain.on('win:close', () => win?.close())
ipcMain.handle('ping', () => 'pong')
