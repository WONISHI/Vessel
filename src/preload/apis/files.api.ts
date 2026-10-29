import type { BaseQueryResult } from "@vessel/obsidian/bases"
import type { CodeDiagnostic, ContentSearchOptions, ContentSearchResult, ImageFile } from "@vessel/type"
import { ipcRenderer } from "electron"

/** 向渲染进程提供受控的文件 IPC 接口，不暴露 Node 文件系统对象。 */
export const filesAPI = {
  shareFilesToWechat: (root: string, paths: string[]): Promise<{ opened: boolean }> => ipcRenderer.invoke("file:share-wechat", root, paths),
  /** Parses and queries an Obsidian Base against the current workspace. */
  queryBase: (root: string, path: string, viewIndex?: number): Promise<BaseQueryResult> => ipcRenderer.invoke("obsidian:query-base", root, path, viewIndex),
  /** Performs the search content operation. */
  searchContent: (options: ContentSearchOptions): Promise<ContentSearchResult> => ipcRenderer.invoke("search:content", options),

  /** Cancels content search. */
  cancelContentSearch: (): void => ipcRenderer.send("search:cancel"),

  /** Performs the pick search folder operation. */
  pickSearchFolder: (): Promise<string | null> => ipcRenderer.invoke("search:pick-folder"),

  /** Copies image. */
  copyImage: (source: string): Promise<void> => ipcRenderer.invoke("image:copy", source),

  /** Returns code diagnostics. */
  getCodeDiagnostics: (path: string, content: string): Promise<CodeDiagnostic[]> => ipcRenderer.invoke("code:diagnostics", path, content),

  /** Reads clipboard image. */
  readClipboardImage: (): Promise<string | null> => ipcRenderer.invoke("image:clipboard"),

  /** Saves content. */
  saveContent: (path: string, content: string): Promise<void> => ipcRenderer.invoke("file:saveContent", path, content),

  /** Reads wiki link. */
  readWikiLink: (root: string, target: string): Promise<{ path: string; content: string }> => ipcRenderer.invoke("obsidian:readWikiLink", root, target),

  /** Performs the reveal workspace file operation. */
  openProjectInEditor: (root: string): Promise<string> => ipcRenderer.invoke("workspace:openInEditor", root),
  revealWorkspaceFile: (root: string, path: string): Promise<void> => ipcRenderer.invoke("workspace:revealFile", root, path),

  /** Reads image file. */
  readImageFile: (root: string, path: string): Promise<ImageFile> => ipcRenderer.invoke("image:readFile", root, path),
  /** 读取指定绝对路径的 UTF-8 文本，读取失败时 Promise 拒绝。 */
  saveObsidianImage: (root: string, documentPath: string, source: { bytes?: Uint8Array; url?: string; path?: string }): Promise<{ name: string; path: string; reference: string }> => ipcRenderer.invoke("obsidian:saveImage", root, documentPath, source),

  /** Reads obsidian image. */
  resolveObsidianImage: (root: string, documentPath: string, reference: string): Promise<string> => ipcRenderer.invoke("obsidian:resolveImage", root, documentPath, reference),
  readObsidianImage: (root: string, documentPath: string, reference: string): Promise<string> => ipcRenderer.invoke("obsidian:readImage", root, documentPath, reference),

  /** Performs the transfer workspace files operation. */
  transferWorkspaceFiles: (root: string, paths: string[], destination: string, external: boolean, duplicate?: boolean): Promise<{ source: string; target: string }[]> => ipcRenderer.invoke("workspace:transferFiles", root, paths, destination, external, duplicate),

  /** Performs the mutate workspace file operation. */
  mutateWorkspaceFile: (root: string, path: string, name?: string): Promise<string> => ipcRenderer.invoke("workspace:mutateFile", root, path, name),

  /** Creates workspace entry. */
  createWorkspaceEntry: (root: string, parent: string, name: string, kind: "file" | "directory") => ipcRenderer.invoke("workspace:createEntry", root, parent, name, kind),

  /** Opens external. */
  openExternal: (href: string): Promise<void> => ipcRenderer.invoke("link:openExternal", href),

  /** Reads content. */
  readContent: (path: string): Promise<string> => ipcRenderer.invoke("file:readContent", path)
}
