import type { WebContents } from "electron"

/** A popup may redirect during its first script, aborting loadURL's original navigation. */
export function loadExtensionPage(contents: WebContents, url: string): Promise<void> {
  const prefix = new URL(url).host
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      contents.removeListener("did-finish-load", finished)
      contents.removeListener("did-fail-load", failed)
      contents.removeListener("destroyed", destroyed)
    }
    const done = (error?: Error) => { cleanup(); if (error) reject(error); else resolve() }
    const finished = () => {
      const current = new URL(contents.getURL())
      if (current.protocol === "chrome-extension:" && current.host === prefix) done()
      else done(new Error("扩展页面跳转到无效地址"))
    }
    const failed = (_event: unknown, code: number, description: string, _url: string, mainFrame: boolean) => {
      if (mainFrame && code !== -3) done(new Error(`扩展页面加载失败：${description} (${code})`))
    }
    const destroyed = () => done(new Error("扩展窗口已关闭"))
    const timer = setTimeout(() => done(new Error("扩展页面加载超时，请重试")), 15000)
    contents.on("did-finish-load", finished)
    contents.on("did-fail-load", failed)
    contents.once("destroyed", destroyed)
    void contents.loadURL(url).catch(error => {
      if (error.code !== "ERR_ABORTED" && error.errno !== -3 && !String(error).includes("ERR_ABORTED")) done(error)
    })
  })
}

export function handleExtensionWindows(contents: WebContents, id: string, openExternal: (url: string) => void) {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`chrome-extension://${id}/`)) {
      setImmediate(() => {
        if (!contents.isDestroyed()) void loadExtensionPage(contents, url).catch(error => console.error("扩展页面跳转失败", error))
      })
    } else if (/^https?:\/\//.test(url)) openExternal(url)
    return { action: "deny" }
  })
}
