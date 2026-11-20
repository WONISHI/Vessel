import { browserFilePreview } from "../../shared/browser-preview"
import { session, type DownloadItem, type WebContents } from "electron"
import { stat } from "node:fs/promises"
import { basename } from "node:path"
import { pathToFileURL } from "node:url"

/** Called only after the writer/download has completed; cancelled or failed saves stay silent. */
export async function notifyBrowserFileSaved(host: WebContents, path: string, source: "download" | "save") {
  const name = basename(path)
  if (!path || !browserFilePreview(name) || host.isDestroyed()) return
  const file = await stat(path).catch(() => undefined)
  if (!file?.isFile() || host.isDestroyed()) return
  host.send("browser:file-saved", { name, url: pathToFileURL(path).href, source })
}

/** Each host sees only downloads started by its own browser guests, including background tabs. */
export function registerBrowserDownloads(host: WebContents) {
  const browser = session.fromPartition("persist:vessel-browser")
  const pending = new Map<DownloadItem, (event: Electron.Event, state: string) => void>()
  const download = (_event: Electron.Event, item: DownloadItem, source: WebContents) => {
    if (!source || source.hostWebContents !== host || source.session !== browser) return
    const done = (_event: Electron.Event, state: string) => {
      pending.delete(item)
      if (state === "completed") void notifyBrowserFileSaved(host, item.getSavePath(), "download").catch(console.error)
    }
    pending.set(item, done)
    item.once("done", done)
  }
  browser.on("will-download", download)
  host.once("destroyed", () => {
    browser.removeListener("will-download", download)
    for (const [item, done] of pending) item.removeListener("done", done)
    pending.clear()
  })
}
