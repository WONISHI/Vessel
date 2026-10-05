import ScreenShot from "js-web-screen-shot"
import "./screenshot.css"
type ScreenshotAPI = { data(): Promise<{ mode: "capture" | "pin"; image: string }>; finish(image: string): Promise<void>; close(): Promise<void>; copy(): Promise<void> }
const api = (window as unknown as { screenshotAPI: ScreenshotAPI }).screenshotAPI
const root = document.getElementById("root")!
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") void api.close()
})
void api
  .data()
  .then(({ mode, image }) => {
    if (mode === "capture") {
      new ScreenShot({
        capture: { source: "image", imageSrc: image },
        completeCallback: ({ base64 }: { base64: string }) => {
          void api.finish(base64).catch(showError)
        },
        closeCallback: () => {
          void api.close()
        }
      })
    } else {
      const toolbar = document.createElement("div")
      toolbar.className = "pin-toolbar"
      toolbar.textContent = "Vessel 贴图"
      const copy = document.createElement("button")
      copy.textContent = "复制"
      copy.onclick = () => {
        void api.copy()
      }
      const close = document.createElement("button")
      close.textContent = "关闭"
      close.onclick = () => {
        void api.close()
      }
      toolbar.append(copy, close)
      const img = document.createElement("img")
      img.src = image
      img.className = "pin-image"
      img.draggable = false
      img.ondblclick = () => {
        void api.close()
      }
      root.append(toolbar, img)
    }
  })
  .catch(showError)
function showError(error: unknown) {
  root.textContent = `截图失败：${String(error)}（Esc 关闭）`
}
