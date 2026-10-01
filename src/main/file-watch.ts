import { subscribe, type AsyncSubscription } from "@parcel/watcher"
import { randomUUID } from "node:crypto"
import { realpath, stat } from "node:fs/promises"
import { isAbsolute } from "node:path"
import type { WebContents } from "electron"

export function registerFileWatch(host: WebContents) {
  const subscriptions = new Map<string, Promise<AsyncSubscription>>()
  let generation = 0
  const stop = async (id: string) => {
    const pending = subscriptions.get(id)
    subscriptions.delete(id)
    await (await pending)?.unsubscribe()
  }
  const clear = () => { generation++; for (const id of subscriptions.keys()) void stop(id).catch(() => {}) }
  host.ipc.handle("files:watch", async (_event, root: string) => {
    if (typeof root !== "string" || !isAbsolute(root)) throw new Error("监听目录无效")
    const currentGeneration = generation
    const directory = await realpath(root)
    if (!(await stat(directory)).isDirectory()) throw new Error("监听目标必须是目录")
    if (host.isDestroyed() || generation !== currentGeneration) throw new Error("窗口已关闭或刷新")
    const id = randomUUID()
    const pending = subscribe(directory, (error, events) => {
      if (!host.isDestroyed() && generation === currentGeneration) host.send("files:changed", root, events.map(event => ({ ...event, path: root + event.path.slice(directory.length) })), error?.message)
    }, { ignore: ["**/.git/**", "**/node_modules/**"] })
    subscriptions.set(id, pending)
    try { await pending } catch (error) { subscriptions.delete(id); throw error }
    return id
  })
  host.ipc.handle("files:unwatch", (_event, id: string) => stop(id))
  host.once("destroyed", clear)
  host.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) clear() })
}
