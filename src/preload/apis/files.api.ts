import { ipcRenderer } from "electron"

/** 向渲染进程提供受控的文件 IPC 接口，不暴露 Node 文件系统对象。 */
export const filesAPI = {
  /** 读取指定绝对路径的 UTF-8 文本，读取失败时 Promise 拒绝。 */
  readContent: (path: string): Promise<string> => ipcRenderer.invoke("file:readContent", path)
}
