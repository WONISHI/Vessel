import { BrowserWindow, type WebContents } from "electron"

/** Capture the fullscreen layout itself, after the native transition and renderer paint. */
export async function fullscreenPreviewWindow(source: WebContents) {
  const window = BrowserWindow.fromWebContents(source)
  if (!window || window.isDestroyed()) throw new Error("模拟截图窗口已关闭")
  window.show()
  window.focus()
  if (!window.isFullScreen()) {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        window.removeListener("enter-full-screen", entered)
        window.removeListener("closed", closed)
      }
      const entered = () => { cleanup(); resolve() }
      const closed = () => { cleanup(); reject(new Error("模拟截图窗口已关闭")) }
      const timer = setTimeout(() => { cleanup(); reject(new Error("进入全屏超时，请重试")) }, 8000)
      window.once("enter-full-screen", entered)
      window.once("closed", closed)
      window.setFullScreen(true)
    })
  }
  await source.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
  return window.getBounds()
}
