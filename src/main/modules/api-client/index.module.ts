import { ApiClientService, type ApiSendOptions } from "@main/modules/api-client/api-client-service"
import { ApiClientStore } from "@main/modules/api-client/store"
import { BaseModule } from "@main/modules/base/index"
import type { ApiImportPayload, ApiOrderItem } from "@vessel/type/api-client"
import { BrowserWindow, app, dialog, ipcMain } from "electron"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"

export class ApiClientModule extends BaseModule {
  private store?: ApiClientStore
  private channels: string[] = []

  /** Handles activate events. */
  protected onActivate(): void {
    const dbPath = join(app.getPath("userData"), "api_client.sqlite")
    const store = (this.store = new ApiClientStore(dbPath))
    const service = new ApiClientService(store)

    const handlers: Record<string, (_event: Electron.IpcMainInvokeEvent, ...args: any[]) => any> = {
      // 网络请求与断言

      /** Performs the "api client:send" operation. */
      "api-client:send": (_e, options: ApiSendOptions) => service.sendRequest(options),

      /** Performs the "api client:runner:run" operation. */
      "api-client:runner:run": (_e, collectionId: string, envVars?: Record<string, string>) => service.runCollection(collectionId, envVars),

      // 集合 Collections

      /** Performs the "api client:collections:list" operation. */
      "api-client:collections:list": () => store.listCollections(),

      /** Performs the "api client:collections:save" operation. */
      "api-client:collections:save": (_e, data: { id: string; name: string; parentId?: string | null }) => store.saveCollection(data),

      /** Performs the "api client:collections:delete" operation. */
      "api-client:collections:delete": (_e, id: string) => store.deleteCollection(id),

      // 请求 Requests

      /** Performs the "api client:requests:list" operation. */
      "api-client:requests:list": (_e, collectionId?: string) => store.listRequests(collectionId),

      /** Performs the "api client:requests:save" operation. */
      "api-client:requests:save": (_e, record: any) => store.saveRequest(record),

      /** Performs the "api client:requests:delete" operation. */
      "api-client:requests:delete": (_e, id: string) => store.deleteRequest(id),
      "api-client:requests:duplicate": (_e, id: string) => store.duplicateRequest(id),
      "api-client:reorder": (_e, items: ApiOrderItem[]) => store.reorder(items),
      "api-client:import": (_e, payload: ApiImportPayload) => store.importItems(payload),

      // Cookies
      "api-client:cookies:list": () => store.listCookies(),
      "api-client:cookies:delete": (_e, filter?: { domain: string; path?: string; name?: string }) => store.deleteCookies(filter),

      /** Saves response bodies / exported collections through a native save dialog. */
      "api-client:save-file": async (event, name: string, content: string, encoding: "text" | "base64" = "text") => {
        if (typeof name !== "string" || typeof content !== "string") throw new Error("文件参数无效")
        const owner = BrowserWindow.fromWebContents(event.sender)
        const options = { title: "保存文件", defaultPath: name }
        const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
        if (result.canceled || !result.filePath) return false
        await writeFile(result.filePath, encoding === "base64" ? Buffer.from(content, "base64") : content)
        return true
      },

      // 历史记录 History

      /** Performs the "api client:history:list" operation. */
      "api-client:history:list": (_e, limit?: number) => store.listHistory(limit),

      /** Performs the "api client:history:clear" operation. */
      "api-client:history:clear": () => store.clearHistory(),

      /** Performs the "api client:history:delete" operation. */
      "api-client:history:delete-request": (_e, method: string, url: string) => store.deleteHistoryRequest(method, url),
      "api-client:history:delete": (_e, id: number) => store.deleteHistory(id),

      // 环境变量 Environments

      /** Performs the "api client:environments:list" operation. */
      "api-client:environments:list": () => store.listEnvironments(),

      /** Performs the "api client:environments:save" operation. */
      "api-client:environments:save": (_e, env: any) => store.saveEnvironment(env),

      /** Performs the "api client:environments:set active" operation. */
      "api-client:environments:set-active": (_e, id: string | null) => store.setActiveEnvironment(id),

      /** Performs the "api client:environments:delete" operation. */
      "api-client:environments:delete": (_e, id: string) => store.deleteEnvironment(id)
    }

    for (const [channel, handler] of Object.entries(handlers)) {
      ipcMain.handle(channel, handler)
      this.channels.push(channel)
    }
  }

  /** Handles dispose events. */
  protected onDispose(): void {
    for (const channel of this.channels) {
      ipcMain.removeHandler(channel)
    }
    this.channels = []
    this.store?.close()
    this.store = undefined
  }
}
