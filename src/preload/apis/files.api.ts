import { ipcRenderer } from "electron"

/** 向渲染进程提供受控的文件 IPC 接口，不暴露 Node 文件系统对象。 */
export const filesAPI = {
  /** 读取指定绝对路径的 UTF-8 文本，读取失败时 Promise 拒绝。 */
  readObsidianImage: (root: string, documentPath: string, reference: string): Promise<string> => ipcRenderer.invoke("obsidian:readImage", root, documentPath, reference),
  mutateWorkspaceFile: (root: string, path: string, name?: string): Promise<string> => ipcRenderer.invoke("workspace:mutateFile", root, path, name),
  createWorkspaceEntry: (root: string, parent: string, name: string, kind: "file" | "directory") => ipcRenderer.invoke("workspace:createEntry", root, parent, name, kind),
  openExternal: (href: string): Promise<void> => ipcRenderer.invoke("link:openExternal", href),
  readContent: (path: string): Promise<string> => ipcRenderer.invoke("file:readContent", path)
}
