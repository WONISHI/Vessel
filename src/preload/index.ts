import { contextBridge } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import { welcomeAPI } from "./apis/welcome.api"
import { developerAPI } from "./apis/developer.api"

import { filesAPI } from "./apis/files.api"

const api = {}

const vesselAPI = {
  ...welcomeAPI,
  ...filesAPI,
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
