import { contextBridge } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import { developerAPI } from "./developer"
import { fileAPI } from "./file"
import { welcomeAPI } from "./welcome"

// Custom APIs for renderer
const api = {}
const vesselAPI = {
  ...welcomeAPI,
  ...fileAPI,
  ...developerAPI
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)
    contextBridge.exposeInMainWorld("api", api)
    contextBridge.exposeInMainWorld("electronAPI", vesselAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.electronAPI = vesselAPI
}
