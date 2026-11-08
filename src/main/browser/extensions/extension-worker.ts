import type { Extension, Session } from "electron"

/** Loading an MV3 manifest is not proof that its background worker started. */
export async function loadExtensionWithWorker(browserSession: Session, path: string) {
  let extension: Extension = await browserSession.extensions.loadExtension(path)
  if (typeof extension.manifest.background?.service_worker !== "string") return extension
  const start = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        browserSession.serviceWorkers.startWorkerForScope(`chrome-extension://${extension.id}/`),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("后台 Service Worker 启动超时")), 10000) })
      ])
    } finally { clearTimeout(timer) }
  }
  try {
    await start()
  } catch {
    // Retry only this extension, retaining its storage, cookies and login state.
    browserSession.extensions.removeExtension(extension.id)
    await new Promise((resolve) => setTimeout(resolve, 200))
    extension = await browserSession.extensions.loadExtension(path)
    try { await start() }
    catch (error) {
      browserSession.extensions.removeExtension(extension.id)
      throw new Error(`扩展后台启动失败：${String(error)}`)
    }
  }
  return extension
}
