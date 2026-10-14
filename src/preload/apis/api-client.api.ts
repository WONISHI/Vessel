import { ipcRenderer } from "electron"
import type {
  ApiSendOptions,
  ApiResponseData
} from "../../main/modules/api-client/api-client-service"
import type {
  ApiCollectionRecord,
  ApiRequestRecord,
  ApiHistoryRecord,
  ApiEnvironmentRecord
} from "../../main/modules/api-client/store"

export const apiClientAPI = {
  send: (options: ApiSendOptions): Promise<ApiResponseData> =>
    ipcRenderer.invoke("api-client:send", options),
  runCollection: (
    collectionId: string,
    envVars?: Record<string, string>
  ): Promise<{
    total: number
    passed: number
    failed: number
    results: { name: string; url: string; status: number; durationMs: number; passed: boolean; testResults: any[] }[]
  }> => ipcRenderer.invoke("api-client:runner:run", collectionId, envVars),

  listCollections: (): Promise<ApiCollectionRecord[]> =>
    ipcRenderer.invoke("api-client:collections:list"),
  saveCollection: (data: { id: string; name: string; parentId?: string | null }): Promise<ApiCollectionRecord[]> =>
    ipcRenderer.invoke("api-client:collections:save", data),
  deleteCollection: (id: string): Promise<ApiCollectionRecord[]> =>
    ipcRenderer.invoke("api-client:collections:delete", id),

  listRequests: (collectionId?: string): Promise<ApiRequestRecord[]> =>
    ipcRenderer.invoke("api-client:requests:list", collectionId),
  saveRequest: (record: ApiRequestRecord): Promise<ApiRequestRecord> =>
    ipcRenderer.invoke("api-client:requests:save", record),
  deleteRequest: (id: string): Promise<void> =>
    ipcRenderer.invoke("api-client:requests:delete", id),

  listHistory: (limit?: number): Promise<ApiHistoryRecord[]> =>
    ipcRenderer.invoke("api-client:history:list", limit),
  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke("api-client:history:clear"),
  deleteHistory: (id: number): Promise<void> =>
    ipcRenderer.invoke("api-client:history:delete", id),

  listEnvironments: (): Promise<ApiEnvironmentRecord[]> =>
    ipcRenderer.invoke("api-client:environments:list"),
  saveEnvironment: (env: ApiEnvironmentRecord): Promise<ApiEnvironmentRecord[]> =>
    ipcRenderer.invoke("api-client:environments:save", env),
  setActiveEnvironment: (id: string | null): Promise<ApiEnvironmentRecord[]> =>
    ipcRenderer.invoke("api-client:environments:set-active", id),
  deleteEnvironment: (id: string): Promise<ApiEnvironmentRecord[]> =>
    ipcRenderer.invoke("api-client:environments:delete", id)
}
