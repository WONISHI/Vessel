import { ipcRenderer } from "electron"
import type { DeviceInfo, PersistedWorkspaceData, RecentWorkspace, WorkspaceDataInput, WorkspaceOpenRecord } from "../../main/modules/welcome/index.type"

export interface StorageInfo {
  databasePath: string
  databaseVersion: number
  deviceId: string
  sessionId: string
}

/**
 * 欢迎页暴露给渲染进程的 API 类型。
 *
 * openDirectory 返回的不是选择文件夹时的基础数据，
 * 而是经过 workspace:recordOpened 保存后的完整工作区数据。
 */
export interface WelcomeAPI {
  openDirectory: () => Promise<PersistedWorkspaceData | null>
  getRecentWorkspaces: (limit?: number) => Promise<RecentWorkspace[]>
  getWorkspaceOpenRecords: (workspaceId: number, limit?: number) => Promise<WorkspaceOpenRecord[]>
  getCurrentDevice: () => Promise<DeviceInfo>
  getAppState: <T>(key: string) => Promise<T | null>
  setAppState: (key: string, value: unknown) => Promise<void>
  deleteAppState: (key: string) => Promise<boolean>
  getStorageInfo: () => Promise<StorageInfo>
}

export const welcomeAPI: WelcomeAPI = {
  /**
   * 选择文件夹并记录本次打开信息。
   *
   * dialog:openDirectory 返回 WorkspaceDataInput；
   * workspace:recordOpened 返回 PersistedWorkspaceData。
   */
  openDirectory: async (): Promise<PersistedWorkspaceData | null> => {
    const workspace = (await ipcRenderer.invoke("dialog:openDirectory")) as WorkspaceDataInput | null

    if (!workspace) return null

    return ipcRenderer.invoke("workspace:recordOpened", workspace) as Promise<PersistedWorkspaceData>
  },

  getRecentWorkspaces: (limit = 10) => ipcRenderer.invoke("workspace:listRecent", limit) as Promise<RecentWorkspace[]>,

  getWorkspaceOpenRecords: (workspaceId: number, limit = 100) => ipcRenderer.invoke("workspace:listOpenRecords", workspaceId, limit) as Promise<WorkspaceOpenRecord[]>,

  getCurrentDevice: () => ipcRenderer.invoke("device:getCurrent") as Promise<DeviceInfo>,

  getAppState: <T>(key: string) => ipcRenderer.invoke("app-state:get", key) as Promise<T | null>,

  setAppState: (key: string, value: unknown) => ipcRenderer.invoke("app-state:set", key, value) as Promise<void>,

  deleteAppState: (key: string) => ipcRenderer.invoke("app-state:delete", key) as Promise<boolean>,

  getStorageInfo: () => ipcRenderer.invoke("storage:getInfo") as Promise<StorageInfo>
}
