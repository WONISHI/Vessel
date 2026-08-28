import { contextBridge } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import { developerAPI } from "./developer"
import { fileAPI } from "./file"
import { welcomeAPI } from "./welcome"

const api = {}

const vesselAPI = {
  ...welcomeAPI,
  ...fileAPI,
  ...developerAPI
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)

    contextBridge.exposeInMainWorld("api", api)

    contextBridge.exposeInMainWorld("electronAPI", vesselAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore 已在 index.d.ts 中声明
  window.electron = electronAPI

  // @ts-ignore 已在 index.d.ts 中声明
  window.api = api

  // @ts-ignore 已在 index.d.ts 中声明
  window.electronAPI = vesselAPI
}
