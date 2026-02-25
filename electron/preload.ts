import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('bridge', {
  ping: () => ipcRenderer.invoke('ping'),
  pyCall: (command: string, args?: any) => ipcRenderer.invoke('py:call', command, args),
  onPyEvent: (callback: (event: any) => void) => ipcRenderer.on('py:event', (e, msg) => callback(msg)),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  authStart: () => ipcRenderer.invoke('auth:start'),
  winMinimize: () => ipcRenderer.send('win:minimize'),
  winMaximize: () => ipcRenderer.send('win:maximize'),
  winClose: () => ipcRenderer.send('win:close'),
})
