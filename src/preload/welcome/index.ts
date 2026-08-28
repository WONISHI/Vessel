import { ipcRenderer } from "electron"

export const welcomeAPI = {
  /**
   * 选择文件夹，并将工作区打开信息保存到数据库。
   */
  openDirectory: async () => {
    const workspace = await ipcRenderer.invoke("dialog:openDirectory")

    if (!workspace) return null

    return ipcRenderer.invoke("workspace:recordOpened", workspace)
  },

  /** 获取最近打开的工作区。 */
  getRecentWorkspaces: (limit = 10) => ipcRenderer.invoke("workspace:listRecent", limit),

  /** 获取指定工作区的打开历史。 */
  getWorkspaceOpenRecords: (workspaceId: number, limit = 100) => ipcRenderer.invoke("workspace:listOpenRecords", workspaceId, limit),

  /** 获取当前设备信息。 */
  getCurrentDevice: () => ipcRenderer.invoke("device:getCurrent"),

  /** 读取一项应用状态。 */
  getAppState: <T>(key: string): Promise<T | null> => ipcRenderer.invoke("app-state:get", key),

  /** 保存或覆盖一项应用状态。 */
  setAppState: (key: string, value: unknown): Promise<void> => ipcRenderer.invoke("app-state:set", key, value),

  /** 删除一项应用状态。 */
  deleteAppState: (key: string): Promise<boolean> => ipcRenderer.invoke("app-state:delete", key),

  /** 获取本地数据库信息。 */
  getStorageInfo: () => ipcRenderer.invoke("storage:getInfo")
}
