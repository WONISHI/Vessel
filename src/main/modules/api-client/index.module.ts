import { app, ipcMain } from "electron"
import { join } from "node:path"
import { BaseModule } from "../base"
import { ApiClientStore } from "./store"
import { ApiClientService, type ApiSendOptions } from "./api-client-service"

export class ApiClientModule extends BaseModule {
  private store?: ApiClientStore
  private channels: string[] = []

  protected onActivate(): void {
    const dbPath = join(app.getPath("userData"), "api_client.sqlite")
    const store = (this.store = new ApiClientStore(dbPath))
    const service = new ApiClientService(store)

    const handlers: Record<string, (_event: Electron.IpcMainInvokeEvent, ...args: any[]) => any> = {
      // 网络请求与断言
      "api-client:send": (_e, options: ApiSendOptions) => service.sendRequest(options),
      "api-client:runner:run": (_e, collectionId: string, envVars?: Record<string, string>) =>
        service.runCollection(collectionId, envVars),

      // 集合 Collections
      "api-client:collections:list": () => store.listCollections(),
      "api-client:collections:save": (_e, data: { id: string; name: string; parentId?: string | null }) =>
        store.saveCollection(data),
      "api-client:collections:delete": (_e, id: string) => store.deleteCollection(id),

      // 请求 Requests
      "api-client:requests:list": (_e, collectionId?: string) => store.listRequests(collectionId),
      "api-client:requests:save": (_e, record: any) => store.saveRequest(record),
      "api-client:requests:delete": (_e, id: string) => store.deleteRequest(id),

      // 历史记录 History
      "api-client:history:list": (_e, limit?: number) => store.listHistory(limit),
      "api-client:history:clear": () => store.clearHistory(),
      "api-client:history:delete": (_e, id: number) => store.deleteHistory(id),

      // 环境变量 Environments
      "api-client:environments:list": () => store.listEnvironments(),
      "api-client:environments:save": (_e, env: any) => store.saveEnvironment(env),
      "api-client:environments:set-active": (_e, id: string | null) => store.setActiveEnvironment(id),
      "api-client:environments:delete": (_e, id: string) => store.deleteEnvironment(id)
    }

    for (const [channel, handler] of Object.entries(handlers)) {
      ipcMain.handle(channel, handler)
      this.channels.push(channel)
    }
  }

  protected onDispose(): void {
    for (const channel of this.channels) {
      ipcMain.removeHandler(channel)
    }
    this.channels = []
    this.store?.close()
    this.store = undefined
  }
}
