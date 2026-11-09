import type { ApiCollectionRecord, ApiCookieRecord, ApiEnvironmentRecord, ApiHistoryRecord, ApiImportPayload, ApiOrderItem, ApiRequestRecord, ApiResponseData, ApiRunResult, ApiSendOptions } from "@vessel/type"
import { ipcRenderer } from "electron"

export const apiClientAPI = {
  /** Sends send. */
  send: (options: ApiSendOptions): Promise<ApiResponseData> => ipcRenderer.invoke("api-client:send", options),

  /** Runs collection. */
  runCollection: (collectionId: string, envVars?: Record<string, string>): Promise<ApiRunResult> => ipcRenderer.invoke("api-client:runner:run", collectionId, envVars),

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
  duplicateRequest: (id: string): Promise<ApiRequestRecord> => ipcRenderer.invoke("api-client:requests:duplicate", id),
  reorder: (items: ApiOrderItem[]): Promise<void> => ipcRenderer.invoke("api-client:reorder", items),
  importItems: (payload: ApiImportPayload): Promise<void> => ipcRenderer.invoke("api-client:import", payload),
  listCookies: (): Promise<ApiCookieRecord[]> => ipcRenderer.invoke("api-client:cookies:list"),
  deleteCookies: (filter?: { domain: string; path?: string; name?: string }): Promise<ApiCookieRecord[]> => ipcRenderer.invoke("api-client:cookies:delete", filter),
  saveFile: (name: string, content: string, encoding?: "text" | "base64"): Promise<boolean> => ipcRenderer.invoke("api-client:save-file", name, content, encoding),

  /** Lists history. */
  listHistory: (limit?: number): Promise<ApiHistoryRecord[]> => ipcRenderer.invoke("api-client:history:list", limit),

  /** Clears history. */
  deleteHistoryRequest: (method: string, url: string): Promise<void> => ipcRenderer.invoke("api-client:history:delete-request", method, url),
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
