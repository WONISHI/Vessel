import { Translate, Copy, X, CaretDown } from "@phosphor-icons/react/ssr"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

export function createOcrDialog(translate: boolean) {
  const overlay = document.createElement("div")
  overlay.className = "shot-dialog-overlay"
  const panel = document.createElement("section")
  panel.className = "shot-ocr shot-translation shot-dialog"
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-modal", "true")
  panel.setAttribute("aria-label", translate ? "截图翻译" : "截图 OCR")
  const glyph = (icon: typeof Copy) => renderToStaticMarkup(createElement(icon, { size: 18, weight: "regular", "aria-hidden": true }))
  const title = document.createElement("h2")
  title.innerHTML = glyph(Translate)
  title.append(translate ? "截图翻译" : "截图 OCR")
  const status = document.createElement("p")
  status.className = "shot-dialog-status"
  status.setAttribute("role", "status")
  status.setAttribute("aria-live", "polite")
  const setStatus = (message: string, state: "busy" | "done" | "error" = "done") => {
    status.textContent = message
    status.dataset.state = state
  }
  setStatus("正在本地识别…", "busy")
  const field = (label: string, target = false) => {
    const wrapper = document.createElement("div")
    wrapper.className = target ? "shot-dialog-field target" : "shot-dialog-field"
    const tag = document.createElement("span")
    tag.className = "shot-dialog-tag"
    tag.textContent = label
    const input = document.createElement("textarea")
    input.setAttribute("aria-label", target ? "截图翻译结果" : "截图识别结果")
    input.placeholder = target ? "点击「翻译」生成译文" : "正在识别截图中的文字…"
    input.readOnly = true
    wrapper.append(tag, input)
    return { wrapper, tag, input }
  }
  const source = field("原文")
  const target = field("译文 · 简体中文", true)
  const controls = document.createElement("div")
  controls.className = "shot-dialog-controls"
  const selectWrap = document.createElement("div")
  selectWrap.className = "shot-dialog-select"
  const language = document.createElement("select")
  language.setAttribute("aria-label", "目标语言")
  for (const [value, label] of [["zh-CN", "简体中文"], ["en", "英语"], ["ja", "日语"], ["ko", "韩语"]]) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = label
    language.append(option)
  }
  const caret = document.createElement("span")
  caret.innerHTML = glyph(CaretDown)
  selectWrap.append(language, caret)
  const makeButton = (label: string, icon: typeof Copy) => {
    const button = document.createElement("button")
    button.type = "button"
    button.innerHTML = glyph(icon)
    const text = document.createElement("span")
    text.textContent = label
    button.append(text)
    return { button, text }
  }
  const retry = makeButton("翻译", Translate)
  retry.button.className = "shot-dialog-primary"
  retry.button.disabled = true
  const setBusy = (busy: boolean, completed = false) => {
    source.input.readOnly = busy
    retry.button.disabled = busy
    language.disabled = busy
    retry.button.classList.toggle("is-busy", busy)
    retry.text.textContent = busy ? "翻译中…" : completed ? "重新翻译" : "翻译"
    panel.setAttribute("aria-busy", String(busy))
  }
  controls.append(selectWrap, retry.button)
  const foot = document.createElement("div")
  foot.className = "shot-dialog-foot"
  const copy = makeButton(translate ? "复制译文" : "复制文字", Copy).button
  copy.disabled = true
  const close = makeButton("关闭", X).button
  foot.append(copy, close)
  panel.append(title, status, source.wrapper)
  if (translate) panel.append(controls, target.wrapper)
  panel.append(foot)
  overlay.append(panel)
  language.addEventListener("change", () => {
    target.tag.textContent = "译文 · " + language.selectedOptions[0].textContent
    target.input.value = ""
    copy.disabled = true
  })
  return { overlay, panel, text: source.input, translated: target.input, language, retry: retry.button, copy, close, setStatus, setBusy }
}
