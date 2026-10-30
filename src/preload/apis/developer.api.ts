import { ipcRenderer } from "electron"

export const developerAPI = {
  /** Opens dev tool. */
  openDevTool: () => ipcRenderer.invoke("open-devtools"),
  previewScreenshot: (): Promise<void> => ipcRenderer.invoke("preview-screenshot")
}
