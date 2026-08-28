import { ipcRenderer } from "electron"

export const fileAPI = {
  readContent: (path: string) => ipcRenderer.invoke("file:readContent", path),
  saveContent: (path: string, content: string) => ipcRenderer.invoke("file:saveContent", path, content)
}
