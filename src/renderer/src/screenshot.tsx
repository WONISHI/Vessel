import ScreenShot from "js-web-screen-shot"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Circle, ListOrdered, ScanText, Copy, Download, Grid3x3, MoveUpRight, Pencil, Pin, Square, Type, Undo2, X } from "lucide-react"
import "./screenshot.css"
import { installSteps, installColorInspector, mergeSteps, type CutBox } from "./screenshot-tools"
import { recognizeImage } from "./lib/image-ocr"
type ScreenshotAPI = { data(): Promise<{ mode: "capture" | "pin"; image: string }>; finish(image: string, pin: boolean): Promise<void>; close(): Promise<void>; copy(): Promise<void>; copyText(text: string): Promise<void> }
const api = (window as unknown as { screenshotAPI: ScreenshotAPI }).screenshotAPI
const root = document.getElementById("root")!
const icon = (Icon: typeof Copy, color = "#44403c") => `url("data:image/svg+xml;utf8,${encodeURIComponent(renderToStaticMarkup(createElement(Icon, { size: 20, color, strokeWidth: 1.8 })))}")`
/** 用 lucide-react 图标覆盖 js-web-screen-shot 自带的位图工具栏图标（普通 / 悬停·选中 / 禁用三态）。 */
function installToolbarIcons() {
  const tools: [string, typeof Copy][] = [["square", Square], ["round", Circle], ["right-top", MoveUpRight], ["brush", Pencil], ["mosaicPen", Grid3x3], ["text", Type], ["save", Download], ["close", X]]
  const base = "background-size:20px 20px !important;background-position:center !important;background-repeat:no-repeat !important;"
  const rules = tools.map(([name, Icon]) =>
    `#toolPanel .${name}{background-image:${icon(Icon)} !important;${base}}` +
    `#toolPanel .${name}:hover,#toolPanel .${name}-active,#toolPanel .${name}:active{background-image:${icon(Icon, "#16a34a")} !important;${base}}`
  )
  rules.push(
    `#toolPanel .undo{background-image:${icon(Undo2)} !important;${base}}`,
    `#toolPanel .undo:hover,#toolPanel .undo:active{background-image:${icon(Undo2, "#16a34a")} !important;${base}}`,
    `#toolPanel .undo-disabled{background-image:${icon(Undo2, "#d6d3d1")} !important;${base}}`
  )
  const style = document.createElement("style")
  style.textContent = rules.join("\n")
  document.head.append(style)
}
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") void api.close()
})
void api
  .data()
  .then(({ mode, image }) => {
    if (mode === "capture") {
      let action: "copy" | "pin" | "ocr" | "save" = "copy"
      let stepTools: ReturnType<typeof installSteps> | undefined
      let stopInspector: (() => void) | undefined
      document.body.style.background = `url("${image}") center / 100% 100% no-repeat`
      document.body.classList.add("shot-idle")
      window.addEventListener("mousedown", () => document.body.classList.remove("shot-idle"), { capture: true, once: true })
      document.documentElement.style.setProperty("--shot-copy-icon", icon(Copy))
      installToolbarIcons()
      const observer = new MutationObserver(() => {
        const confirm = document.querySelector<HTMLElement>("#toolPanel .confirm")
        if (!confirm || document.querySelector("#toolPanel .shot-pin")) return
        const copy = confirm.parentElement?.classList.contains("item-panel") ? confirm.parentElement : confirm
        copy.title = "复制"
        const tool = (className: string, title: string, Icon: typeof Copy, callback?: () => void) => {
          const button = document.createElement("button")
          button.type = "button"; button.className = `item-panel ${className}`; button.title = title; button.setAttribute("aria-label", title)
          button.style.backgroundImage = icon(Icon)
          if (callback) button.onclick = callback
          copy.before(button)
          return button
        }
        const steps = tool("shot-step", "步骤标注", ListOrdered)
        stepTools = installSteps(plugin, steps)
        tool("shot-step-undo", "撤销步骤", Undo2, () => stepTools?.undo())
        tool("shot-recognize", "截图 OCR", ScanText, () => { action = "ocr"; confirm.click() })
        const pin = tool("shot-pin", "固定到屏幕", Pin, () => { action = "pin"; confirm.click() })
        copy.after(pin)
        // Route downloads through the same compositor so numbered steps are included.
        const save = document.querySelector<HTMLElement>("#toolPanel .save")
        save?.addEventListener("click", event => { event.preventDefault(); event.stopImmediatePropagation(); action = "save"; confirm.click() }, true)
      })
      observer.observe(document.body, { childList: true, subtree: true })
      const plugin = new ScreenShot({
        capture: { source: "image", imageSrc: image },
        level: 100,
        showScreenData: true,
        completeCallback: ({ base64, cutInfo }: { base64: string; cutInfo: CutBox }) => {
          observer.disconnect(); stopInspector?.(); stepTools?.hide()
          void mergeSteps(base64, cutInfo, stepTools?.steps || []).then(async result => {
            if (action === "ocr") { await showOcr(result); return }
            if (action === "save") {
              const download = document.createElement("a"); download.href = result; download.download = `Vessel-${Date.now()}.png`; download.click(); await api.close(); return
            }
            await api.finish(result, action === "pin")
          }).catch(showError)
        },
        closeCallback: () => { void api.close() }
      })
      void installColorInspector(image, value => api.copyText(value)).then(dispose => { stopInspector = dispose }).catch(showError)

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

async function showOcr(image: string) {
  const panel = document.createElement("section"); panel.className = "shot-ocr"
  const title = document.createElement("h2"); title.textContent = "截图 OCR"
  const status = document.createElement("p"); status.textContent = "正在本地识别…"
  const text = document.createElement("textarea"); text.setAttribute("aria-label", "截图识别结果"); text.placeholder = "识别结果"; text.readOnly = true
  const copy = document.createElement("button"); copy.textContent = "复制文字"; copy.disabled = true
  copy.onclick = () => { void api.copyText(text.value).then(() => { status.textContent = "已复制" }, error => { status.textContent = String(error) }) }
  const close = document.createElement("button"); close.textContent = "关闭"; close.onclick = () => { void api.close() }
  panel.append(title, status, text, copy, close); root.append(panel)
  try { text.value = await recognizeImage(image); text.readOnly = false; copy.disabled = !text.value; status.textContent = text.value ? "识别完成 · 本地离线" : "未识别到文字" }
  catch (error) { status.textContent = `识别失败：${error instanceof Error ? error.message : String(error)}` }
}
