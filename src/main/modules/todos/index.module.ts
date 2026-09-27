import { app, ipcMain } from "electron"
import { join } from "node:path"
import { BaseModule } from "../base"
import { TodoStore } from "./store"
export class TodosModule extends BaseModule {
  private store?: TodoStore
  private channels: string[] = []
  protected onActivate() {
    try {
      const store = (this.store = new TodoStore(join(app.getPath("userData"), "todos.sqlite")))
      const handlers: Record<string, (...args: never[]) => unknown> = {
        "todos:list": () => store.list(),
        "todos:add": (date: string, title: string) => store.add(date, title),
        "todos:complete": (id: number, done: boolean) => store.complete(id, done),
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
  protected onDispose() {
    this.channels.forEach((channel) => ipcMain.removeHandler(channel))
    this.channels = []
    this.store?.close()
    this.store = undefined
  }
}
