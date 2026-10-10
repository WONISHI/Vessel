import type { ImageFile } from "../../shared/image-file"
import { ipcRenderer } from "electron"

/** 向渲染进程提供受控的文件 IPC 接口，不暴露 Node 文件系统对象。 */
export const filesAPI = {
  copyImage: (source: string): Promise<void> => ipcRenderer.invoke("image:copy", source),
  getCodeDiagnostics: (path: string, content: string): Promise<import("../../shared/code-diagnostics").CodeDiagnostic[]> => ipcRenderer.invoke("code:diagnostics", path, content),
  readClipboardImage: (): Promise<string | null> => ipcRenderer.invoke("image:clipboard"),
  saveContent: (path: string, content: string): Promise<void> => ipcRenderer.invoke("file:saveContent", path, content),
  readWikiLink: (root: string, target: string): Promise<{ path: string; content: string }> => ipcRenderer.invoke("obsidian:readWikiLink", root, target),
  revealWorkspaceFile: (root: string, path: string): Promise<void> => ipcRenderer.invoke("workspace:revealFile", root, path),
  readImageFile: (root: string, path: string): Promise<ImageFile> => ipcRenderer.invoke("image:readFile", root, path),
  /** 读取指定绝对路径的 UTF-8 文本，读取失败时 Promise 拒绝。 */
  readObsidianImage: (root: string, documentPath: string, reference: string): Promise<string> => ipcRenderer.invoke("obsidian:readImage", root, documentPath, reference),
  mutateWorkspaceFile: (root: string, path: string, name?: string): Promise<string> => ipcRenderer.invoke("workspace:mutateFile", root, path, name),
  createWorkspaceEntry: (root: string, parent: string, name: string, kind: "file" | "directory") => ipcRenderer.invoke("workspace:createEntry", root, parent, name, kind),
  openExternal: (href: string): Promise<void> => ipcRenderer.invoke("link:openExternal", href),
  readContent: (path: string): Promise<string> => ipcRenderer.invoke("file:readContent", path)
}
