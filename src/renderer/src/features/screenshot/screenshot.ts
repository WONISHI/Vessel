import { createOcrDialog } from "@/features/screenshot/ocr-dialog"
import { arrangeScreenshotToolbar } from "@/features/screenshot/toolbar-order"
import { installToolbarTooltip } from "@/features/screenshot/toolbar-tooltip"
import { installToolbarDrag } from "@/features/screenshot/toolbar-drag"
import { installScreenshotModes, updateScreenshotToolbar } from "@/features/screenshot/mode-menu"
import { installOptionArrow } from "@/features/screenshot/option-arrow"
import { installColorInspector, installSteps, mergeSteps, type CutBox } from "@/features/screenshot/screenshot-tools"
import "@/features/screenshot/screenshot.css"
import { recognizeImage } from "@/lib/image/image-ocr"
import "@fontsource/plus-jakarta-sans/400.css"
import "@fontsource/plus-jakarta-sans/600.css"
import { matchesShortcut } from "@vessel/utils"
import ScreenShot from "js-web-screen-shot"
import { Check, Circle, Copy, DownloadSimple as Download, Translate as Languages, PencilLine, NumberCircleOne as ListOrdered, ArrowUpRight as MoveUpRight, PencilSimpleLine, PushPin as Pin, Scan as ScanText, Square, TextT as Type, ArrowUUpLeft as Undo2, DotsThree, X } from "@phosphor-icons/react/ssr"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
type ScreenshotAPI = { pinMenu(): Promise<void>; pinStyle(style: { opacity?: number; shadow?: boolean }): Promise<void>; onPinStyleToggle(callback: () => void): () => void; ready(): Promise<void>; data(): Promise<{ mode: "capture" | "pin"; image: string }>; finish(image: string, pin: boolean): Promise<void>; close(): Promise<void>; copy(): Promise<void>; copyText(text: string): Promise<void>; translate(text: string, target: string): Promise<string> }
const api = (window as unknown as { screenshotAPI: ScreenshotAPI }).screenshotAPI
const root = document.getElementById("root")!
// The annotation library uses "none" as its canvas font family. Keep its size
// and weight while supplying the same bundled font as the screenshot UI.
const canvasFont = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "font")!
Object.defineProperty(CanvasRenderingContext2D.prototype, "font", {
  ...canvasFont,

  /** Sets set. */
  set(value: string) {
    canvasFont.set!.call(this, value.replace(/\bnone$/, '"Plus Jakarta Sans", "PingFang SC", sans-serif'))
  }
})

/** Performs the icon operation. */
const icon = (Icon: typeof Copy, color = "#171717") => `url("data:image/svg+xml;utf8,${encodeURIComponent(renderToStaticMarkup(createElement(Icon, { size: 20, color, weight: "regular" })))}")`
/** 用 Phosphor 图标覆盖 js-web-screen-shot 自带的位图工具栏图标（普通 / 悬停·选中 / 禁用三态）。 */
function installToolbarIcons() {
  const tools: [string, typeof Copy][] = [
    ["square", Square],
    ["round", Circle],
    ["right-top", MoveUpRight],
    ["brush", PencilSimpleLine],
    ["mosaicPen", PencilLine],
    ["text", Type],
    ["save", Download],
    ["close", X]
  ]
  const base = "background-size:20px 20px !important;background-position:center !important;background-repeat:no-repeat !important;"
  const rules = tools.map(([name, Icon]) => `#toolPanel .${name}{background-image:${icon(Icon)} !important;${base}}` + `#toolPanel .${name}:hover,#toolPanel .${name}-active,#toolPanel .${name}:active{background-image:${icon(Icon, "#171717")} !important;${base}}`)
  rules.push(
    `#toolPanel .close,#toolPanel .close:hover,#toolPanel .close:active{background-image:${icon(X, "#ff454d")} !important;${base}}`,
    `#toolPanel .save,#toolPanel .save:hover,#toolPanel .save:active{background-image:${icon(Download, "#168bfa")} !important;${base}}`,
    `#toolPanel .shot-step[aria-pressed=true]{background-image:${icon(ListOrdered, "#171717")} !important;${base}}`,
    `#toolPanel .undo{background-image:${icon(Undo2)} !important;${base}}`,
    `#toolPanel .undo:hover,#toolPanel .undo:active{background-image:${icon(Undo2, "#171717")} !important;${base}}`,
    `#toolPanel .undo-disabled.shot-can-undo{background-image:${icon(Undo2)} !important;${base}}`,
    `#toolPanel .undo-disabled:not(.shot-can-undo),#toolPanel .undo-disabled:not(.shot-can-undo):hover,#toolPanel .undo-disabled:not(.shot-can-undo):active{background-image:${icon(Undo2, "#a8adaa")} !important;${base}}`
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
  .then(async ({ mode, image }) => {
    const bitmap = new Image()
    bitmap.src = image
    await bitmap.decode()
    await document.fonts.ready
    if (mode === "capture") {
      let action: "copy" | "pin" | "ocr" | "save" | "translate" = "copy"
      let stepTools: ReturnType<typeof installSteps> | undefined
      let stopTooltip: (() => void) | undefined
      let stopToolbarDrag: (() => void) | undefined
      let stopModeMenu: (() => void) | undefined
      let stopOptionArrow: (() => void) | undefined
      let stopInspector: (() => void) | undefined
      document.body.style.background = `url("${image}") center / 100% 100% no-repeat`
      document.body.classList.add("shot-idle")
      window.addEventListener("mousedown", () => document.body.classList.remove("shot-idle"), { capture: true, once: true })
      document.documentElement.style.setProperty("--shot-copy-icon", icon(Check, "#00ba69"))
      installToolbarIcons()
      const observer = new MutationObserver(() => {
        const confirm = document.querySelector<HTMLElement>("#toolPanel .confirm")
        if (!confirm || document.querySelector("#toolPanel .shot-pin")) return
        const copy = confirm.parentElement?.classList.contains("item-panel") ? confirm.parentElement : confirm
        // data-title is the plugin's command key, not just its tooltip.
        // completeScreenshot() looks up the literal "confirm" value.
        copy.dataset.title = "confirm"
        copy.title = "完成并复制"
        copy.setAttribute("aria-label", "完成并复制")
        const heading = document.createElement("div")
        heading.className = "shot-toolbar-heading"
        const grip = document.createElement("span")
        grip.className = "shot-toolbar-grip"
        grip.title = "按住拖动工具栏"
        grip.setAttribute("aria-label", "拖动工具栏")
        const dot = document.createElement("span")
        dot.className = "shot-toolbar-dot"
        heading.append(grip, dot)
        const toolbar = copy.closest<HTMLElement>("#toolPanel")
        stopModeMenu = installScreenshotModes(heading, (mode) => {
          action = mode
          if (toolbar) updateScreenshotToolbar(toolbar, mode)
          const Icon = mode === "ocr" ? ScanText : mode === "translate" ? Languages : Check
          document.documentElement.style.setProperty("--shot-copy-icon", icon(Icon, "#00ba69"))
        })
        if (toolbar) updateScreenshotToolbar(toolbar, "copy")
        toolbar?.prepend(heading)
        if (toolbar) {
          stopOptionArrow = installOptionArrow(toolbar)
          stopToolbarDrag = installToolbarDrag(toolbar, grip)
        }

        /** Performs the tool operation. */
        const tool = (className: string, title: string, Icon: typeof Copy, callback?: () => void) => {
          const button = document.createElement("button")
          button.type = "button"
          button.className = `item-panel ${className}`
          button.dataset.title = title
          button.setAttribute("aria-label", title)
          button.style.backgroundImage = icon(Icon)
          if (callback) button.onclick = callback
          copy.before(button)
          return button
        }
        const steps = tool("shot-step", "步骤标注", ListOrdered)
        stepTools = installSteps(plugin, steps)
        document.querySelector("#toolPanel .undo, #toolPanel .undo-disabled")?.parentElement?.addEventListener(
          "click",
          (event) => {
            if (!(event.target instanceof Element) || !event.target.closest(".undo, .undo-disabled")) return
            if (stepTools?.undo()) {
              event.preventDefault()
              event.stopImmediatePropagation()
            }
          },
          true
        )
        const pin = tool("shot-pin", "固定到屏幕", Pin, () => {
          action = "pin"
          confirm.click()
        })
        copy.before(pin)
        if (toolbar) arrangeScreenshotToolbar(toolbar)
        if (toolbar) stopTooltip = installToolbarTooltip(toolbar)
        // Route downloads through the same compositor so numbered steps are included.
        const save = document.querySelector<HTMLElement>("#toolPanel .save")
        save?.addEventListener(
          "click",
          (event) => {
            event.preventDefault()
            event.stopImmediatePropagation()
            action = "save"
            confirm.click()
          },
          true
        )
      })
      observer.observe(document.body, { childList: true, subtree: true })
      const plugin = new ScreenShot({
        capture: { source: "image", imageSrc: image },
        level: 100,
        showScreenData: false,
        writeBase64: false,
        exportOptions: { type: "image/png" },
        useRatioArrow: true,

        /** Performs the trigger callback operation. */
        triggerCallback: ({ code }) => {
          if (code === 0)
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                void api.ready()
              })
            )
        },

        /** Performs the complete callback operation. */
        completeCallback: ({ base64, cutInfo }: { base64: string; cutInfo: CutBox }) => {
          observer.disconnect()
          stopOptionArrow?.()
          stopModeMenu?.()
          stopToolbarDrag?.()
          stopTooltip?.()
          stopInspector?.()
          stepTools?.hide()
          void mergeSteps(base64, cutInfo, stepTools?.steps || [])
            .then(async (result) => {
              if (action === "ocr" || action === "translate") {
                await showOcr(result, action === "translate")
                return
              }
              if (action === "save") {
                const download = document.createElement("a")
                download.href = result
                download.download = `Vessel-${Date.now()}.png`
                download.click()
                await api.close()
                return
              }
              await api.finish(result, action === "pin")
            })
            .catch(showError)
        },

        /** Closes callback. */
        closeCallback: () => {
          void api.close()
        }
      })
      window.addEventListener("keydown", (event) => {
        if (matchesShortcut(event, "pinScreenshot")) {
          event.preventDefault()
          action = "pin"
          plugin.completeScreenshot()
        }
      })
      void installColorInspector(
        image,
        (value) => api.copyText(value),
        () => plugin.getCutBoxInfo().width > 0
      )
        .then((dispose) => {
          stopInspector = dispose
        })
        .catch(showError)
    } else {
      document.body.classList.add("shot-pin-window")
      const more = document.createElement("button")
      more.className = "pin-more"
      more.type = "button"
      more.title = "贴图菜单"
      more.setAttribute("aria-label", "贴图菜单")
      more.innerHTML = renderToStaticMarkup(createElement(DotsThree, { size: 22, weight: "bold" }))
      more.onclick = () => { void api.pinMenu().catch(showError) }
      const styleBar = document.createElement("div")
      styleBar.className = "pin-style-bar"
      styleBar.hidden = true
      const label = document.createElement("label")
      label.textContent = "不透明度"
      const opacity = document.createElement("input")
      opacity.type = "range"
      opacity.min = "20"
      opacity.max = "100"
      opacity.value = "100"
      opacity.setAttribute("aria-label", "贴图不透明度")
      opacity.oninput = () => { void api.pinStyle({ opacity: Number(opacity.value) / 100 }) }
      label.append(opacity)
      styleBar.append(label)
      const toggleStyle = () => { styleBar.hidden = !styleBar.hidden }
      api.onPinStyleToggle(toggleStyle)
      const img = document.createElement("img")
      img.src = image
      img.className = "pin-image"
      img.draggable = false
      root.append(img, more, styleBar)

    }
  })
  .catch(showError)

/** Shows error. */
function showError(error: unknown) {
  root.textContent = `截图失败：${String(error)}（Esc 关闭）`
}

/** Shows ocr. */
async function showOcr(image: string, translate = false) {
  const { overlay, text, translated, language, retry, copy, close, setStatus, setBusy } = createOcrDialog(translate)
  const runTranslation = async () => {
    setBusy(true)
    copy.disabled = true
    translated.value = ""
    setStatus("正在翻译…", "busy")
    try {
      translated.value = await api.translate(text.value, language.value)
      copy.disabled = !translated.value
      setStatus("翻译完成")
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")
      setStatus(`翻译失败：${message}`, "error")
    } finally {
      setBusy(false, !!translated.value)
    }
  }
  retry.onclick = () => void runTranslation()
  copy.onclick = () => {
    void api.copyText(translate ? translated.value : text.value).then(
      () => {
        setStatus("已复制到剪贴板")
      },
      (error) => {
        setStatus(String(error), "error")
      }
    )
  }
  close.onclick = () => { void api.close() }
  text.oninput = () => {
    if (translate) { translated.value = ""; copy.disabled = true; setStatus("原文已修改，请重新翻译") }
    else copy.disabled = !text.value.trim()
  }
  root.append(overlay)
  try {
    text.value = await recognizeImage(image)
    text.readOnly = false
    copy.disabled = translate || !text.value
    setStatus(text.value ? "识别完成 · 本地离线" : "未识别到文字")
    retry.disabled = !text.value.trim()
    if (translate && text.value) {
      await runTranslation()
    }
  } catch (error) {
    setStatus(`识别失败：${error instanceof Error ? error.message : String(error)}`, "error")
  }
}
