import { ipcRenderer } from "electron"

export const developerAPI = {
  openDevTool: () => ipcRenderer.invoke("open-devtools")
}
