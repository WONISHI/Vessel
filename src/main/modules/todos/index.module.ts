import { BaseModule } from "@main/modules/base/index"
import { TodoStore } from "@main/modules/todos/store"
import { app, ipcMain } from "electron"
import { join } from "node:path"
export class TodosModule extends BaseModule {
  private store?: TodoStore
  private channels: string[] = []

  /** Handles activate events. */
  protected onActivate() {
    try {
      const store = (this.store = new TodoStore(join(app.getPath("userData"), "todos.sqlite")))
      const handlers: Record<string, (...args: never[]) => unknown> = {
        /** Performs the "todos:list" operation. */
        "todos:list": () => store.list(),

        /** Performs the "todos:add" operation. */
        "todos:add": (date: string, title: string) => store.add(date, title),

        /** Performs the "todos:complete" operation. */
        "todos:complete": (id: number, done: boolean) => store.complete(id, done),

        /** Performs the "todos:delete" operation. */
        "todos:delete": (id: number) => store.remove(id)
      }
      for (const [channel, handler] of Object.entries(handlers)) {
        ipcMain.handle(channel, (_event, ...args) => handler(...(args as never[])))
        this.channels.push(channel)
      }
    } catch (error) {
      this.onDispose()
      throw error
    }
  }

  /** Handles dispose events. */
  protected onDispose() {
    this.channels.forEach((channel) => ipcMain.removeHandler(channel))
    this.channels = []
    this.store?.close()
    this.store = undefined
  }
}
