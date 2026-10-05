import ScreenShot from "js-web-screen-shot"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Copy, Pin } from "lucide-react"
import "./screenshot.css"
type ScreenshotAPI = { data(): Promise<{ mode: "capture" | "pin"; image: string }>; finish(image: string, pin: boolean): Promise<void>; close(): Promise<void>; copy(): Promise<void> }
const api = (window as unknown as { screenshotAPI: ScreenshotAPI }).screenshotAPI
const root = document.getElementById("root")!
const icon = (Icon: typeof Copy) => `url("data:image/svg+xml;utf8,${encodeURIComponent(renderToStaticMarkup(createElement(Icon, { size: 20, color: "#44403c", strokeWidth: 1.8 })))}")`
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") void api.close()
})
void api
  .data()
  .then(({ mode, image }) => {
    if (mode === "capture") {
      let pinNext = false
      // 选区开始前保持完全透明（直接显示屏幕画面），按下鼠标后才出现灰色蒙层 + 透明选区。
      document.body.style.background = `url("${image}") center / 100% 100% no-repeat`
      document.body.classList.add("shot-idle")
      window.addEventListener("mousedown", () => document.body.classList.remove("shot-idle"), { capture: true, once: true })
      document.documentElement.style.setProperty("--shot-copy-icon", icon(Copy))
      document.documentElement.style.setProperty("--shot-pin-icon", icon(Pin))
      // 在截图工具栏里追加「固定到屏幕」按钮；对勾（confirm）仅复制到剪贴板。
      new MutationObserver(() => {
        const confirm = document.querySelector<HTMLElement>("#toolPanel .confirm")
        if (!confirm || document.querySelector("#toolPanel .shot-pin")) return
        const copy = confirm.parentElement?.classList.contains("item-panel") ? confirm.parentElement : confirm
        copy.title = "复制"
        const pin = document.createElement("div")
        pin.className = "item-panel shot-pin"
        pin.title = "固定到屏幕"
        pin.onclick = () => {
          pinNext = true
          confirm.click()
        }
        copy.after(pin)
      }).observe(document.body, { childList: true, subtree: true })
      new ScreenShot({
        capture: { source: "image", imageSrc: image },
        showScreenData: true,
        completeCallback: ({ base64 }: { base64: string }) => {
          const pin = pinNext
          pinNext = false
          void api.finish(base64, pin).catch(showError)
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
