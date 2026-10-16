import type { ApiCollectionRecord, ApiEnvironmentRecord, ApiHistoryRecord, ApiRequestRecord, ApiResponseData, ApiSendOptions } from "@vessel/type"
import { ipcRenderer } from "electron"

export const apiClientAPI = {
  /** Sends send. */
  send: (options: ApiSendOptions): Promise<ApiResponseData> => ipcRenderer.invoke("api-client:send", options),

  /** Runs collection. */
  runCollection: (
    collectionId: string,
    envVars?: Record<string, string>
  ): Promise<{
    total: number
    passed: number
    failed: number
    results: { name: string; url: string; status: number; durationMs: number; passed: boolean; testResults: any[] }[]
  }> => ipcRenderer.invoke("api-client:runner:run", collectionId, envVars),

  /** Lists collections. */
  listCollections: (): Promise<ApiCollectionRecord[]> => ipcRenderer.invoke("api-client:collections:list"),

  /** Saves collection. */
  saveCollection: (data: { id: string; name: string; parentId?: string | null }): Promise<ApiCollectionRecord[]> => ipcRenderer.invoke("api-client:collections:save", data),

  /** Deletes collection. */
  deleteCollection: (id: string): Promise<ApiCollectionRecord[]> => ipcRenderer.invoke("api-client:collections:delete", id),

  /** Lists requests. */
  listRequests: (collectionId?: string): Promise<ApiRequestRecord[]> => ipcRenderer.invoke("api-client:requests:list", collectionId),

  /** Saves request. */
  saveRequest: (record: ApiRequestRecord): Promise<ApiRequestRecord> => ipcRenderer.invoke("api-client:requests:save", record),

  /** Deletes request. */
  deleteRequest: (id: string): Promise<void> => ipcRenderer.invoke("api-client:requests:delete", id),

  /** Lists history. */
  listHistory: (limit?: number): Promise<ApiHistoryRecord[]> => ipcRenderer.invoke("api-client:history:list", limit),

  /** Clears history. */
  clearHistory: (): Promise<void> => ipcRenderer.invoke("api-client:history:clear"),

  /** Deletes history. */
  deleteHistory: (id: number): Promise<void> => ipcRenderer.invoke("api-client:history:delete", id),

  /** Lists environments. */
  listEnvironments: (): Promise<ApiEnvironmentRecord[]> => ipcRenderer.invoke("api-client:environments:list"),

  /** Saves environment. */
  saveEnvironment: (env: ApiEnvironmentRecord): Promise<ApiEnvironmentRecord[]> => ipcRenderer.invoke("api-client:environments:save", env),

  /** Sets active environment. */
  setActiveEnvironment: (id: string | null): Promise<ApiEnvironmentRecord[]> => ipcRenderer.invoke("api-client:environments:set-active", id),

  /** Deletes environment. */
  deleteEnvironment: (id: string): Promise<ApiEnvironmentRecord[]> => ipcRenderer.invoke("api-client:environments:delete", id)
}
