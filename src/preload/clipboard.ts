import { contextBridge, ipcRenderer } from "electron"
import type { ClipboardHistoryAPI } from "@vessel/type"

const subscribe = (channel: string, callback: () => void) => {
  const listener = () => callback()
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}
const api: ClipboardHistoryAPI = {
  state: (filter) => ipcRenderer.invoke("clipboard:state", filter),
  copy: (id, plainText) => ipcRenderer.invoke("clipboard:copy", id, plainText),
  pin: (id) => ipcRenderer.invoke("clipboard:pin", id),
  remove: (id) => ipcRenderer.invoke("clipboard:remove", id),
  clear: () => ipcRenderer.invoke("clipboard:clear"),
  pause: (paused) => ipcRenderer.invoke("clipboard:pause", paused),
  keepOpen: (value) => ipcRenderer.invoke("clipboard:keep-open", value),
  close: () => ipcRenderer.invoke("clipboard:close"),
  onChange: (callback) => subscribe("clipboard:changed", callback),
  onShow: (callback) => subscribe("clipboard:show", callback)
}
contextBridge.exposeInMainWorld("clipboardAPI", api)
