/**
 * Vessel-owned text input for the screenshot annotator.
 * js-web-screen-shot's #textInputPanel path is unreliable in the Electron panel
 * window; when the text tool is active we create our own dashed textarea inside
 * the crop and commit through the plugin addElement API.
 */
import type { CutBox } from "./screenshot-tools"
import { getScreenshotTextFormat, screenshotTextFont } from "./text-options"

const EDITOR_ID = "vesselTextInput"
const CHROME = "#toolPanel, #optionPanel, #optionIcoController, .shot-ocr, .shot-dialog-overlay, .shot-step-caption, .shot-shapes-menu, .shot-mode-menu, .shot-steps-menu, #vesselTextInput"

type TextPayload = {
  text: string
  color: string
  fontSize: number
}

type CustomElement = {
  id: string
  x: number
  y: number
  width: number
  height: number
  toolId?: number
  toolName?: string
  payload?: unknown
  customType: "custom"
}

type VesselShotApi = {
  addElement: (input: Record<string, unknown>) => unknown
  saveHistory?: () => void
  redraw?: () => void
}

type EditorSession = {
  canvasX: number
  canvasY: number
  color: string
  fontSize: number
}

function shotApi(): VesselShotApi | null {
  const api = (globalThis as unknown as { __vesselShotApi?: VesselShotApi }).__vesselShotApi
  return api && typeof api.addElement === "function" ? api : null
}

function pushHistory() {
  const api = shotApi()
  if (api?.saveHistory) {
    api.saveHistory()
    return
  }
  const history = (globalThis as unknown as { __vesselShotHistory?: () => void }).__vesselShotHistory
  history?.()
}

function measureText(text: string, fontSize: number, context: CanvasRenderingContext2D) {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const lineHeight = Math.max(1, Math.round(fontSize * 1.2))
  context.save()
  context.font = screenshotTextFont(`bold ${fontSize}px none`)
  let width = 0
  for (const line of lines) width = Math.max(width, context.measureText(line || " ").width)
  context.restore()
  return { width: Math.max(width, fontSize * 0.6), height: Math.max(lineHeight * lines.length, lineHeight), lineHeight, lines }
}

function asPayload(element: CustomElement): TextPayload {
  const payload = (element.payload || {}) as Partial<TextPayload>
  return {
    text: payload.text || "",
    color: payload.color || "#F53440",
    fontSize: payload.fontSize || 17
  }
}

function drawVesselText(element: CustomElement, context: CanvasRenderingContext2D) {
  const payload = asPayload(element)
  if (!payload.text) return
  const { lines, lineHeight } = measureText(payload.text, payload.fontSize, context)
  context.save()
  context.fillStyle = payload.color
  context.textBaseline = "middle"
  context.textAlign = "left"
  context.font = screenshotTextFont(`bold ${payload.fontSize}px none`)
  lines.forEach((line, index) => {
    context.fillText(line, element.x, element.y + lineHeight / 2 + lineHeight * index)
  })
  context.restore()
}

/** Adapter so plugin history / redraw / export include Vessel-committed text. */
export function vesselTextAdapters() {
  return [
    {
      toolName: "vessel-text",
      draw: drawVesselText,
      hitTest: (element: CustomElement, point: { x: number; y: number }) =>
        point.x >= element.x && point.x <= element.x + element.width && point.y >= element.y && point.y <= element.y + element.height,
      move: (element: CustomElement, delta: { x: number; y: number }) => ({
        ...element,
        x: element.x + delta.x,
        y: element.y + delta.y,
        payload: asPayload(element)
      })
    }
  ]
}

function isTextTool(toolbar: HTMLElement) {
  return !!toolbar.querySelector(".text-active, .item-panel:has(.text-active), .item-panel.text-active")
}

function readColor() {
  const selected = document.querySelector<HTMLElement>("#optionPanel .color-item.active, #optionPanel .color-select-panel .active, #optionPanel .color-item[data-selected='true']")
  if (selected) {
    const bg = selected.style.backgroundColor || getComputedStyle(selected).backgroundColor
    if (bg) return bg
  }
  const panel = document.querySelector<HTMLElement>("#optionPanel .color-select-panel")
  if (panel) {
    const bg = panel.style.backgroundColor || getComputedStyle(panel).backgroundColor
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg
  }
  return "#F53440"
}

function readFontSize() {
  const label = document.querySelector<HTMLElement>("#optionPanel .text-size-panel")
  const raw = label?.textContent?.trim() || ""
  const size = Number.parseInt(raw, 10)
  return Number.isFinite(size) && size > 0 ? size : 17
}

function canvasEl() {
  return document.getElementById("screenShotContainer") as HTMLCanvasElement | null
}

function clientToCanvas(clientX: number, clientY: number) {
  const canvas = canvasEl()
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
    rect
  }
}

function insideCrop(x: number, y: number, box: CutBox) {
  return box.width > 0 && box.height > 0 && x >= box.startX && y >= box.startY && x <= box.startX + box.width && y <= box.startY + box.height
}

function ensureEditor() {
  let node = document.getElementById(EDITOR_ID) as HTMLTextAreaElement | null
  if (node) return node
  // textarea: reliable caret + CJK IME in Electron panel windows (contenteditable was flaky).
  node = document.createElement("textarea")
  node.id = EDITOR_ID
  node.setAttribute("aria-label", "截图文字输入")
  node.setAttribute("autocomplete", "off")
  node.setAttribute("autocapitalize", "off")
  node.setAttribute("spellcheck", "false")
  node.setAttribute("inputmode", "text")
  node.setAttribute("enterkeyhint", "enter")
  node.rows = 1
  node.tabIndex = 0
  node.dataset.vesselText = "1"
  document.body.append(node)
  return node
}

function applyFormat(node: HTMLTextAreaElement, color: string, fontSize: number) {
  const format = getScreenshotTextFormat()
  node.style.color = color
  node.style.fontSize = `${fontSize}px`
  node.style.fontWeight = "700"
  node.style.fontStyle = format.italic ? "italic" : "normal"
  node.style.fontFamily = format.family === "sans-serif" ? '"Vessel Screenshot Text", sans-serif' : format.family
  node.style.textDecoration = [format.underline ? "underline" : "", format.strike ? "line-through" : ""].filter(Boolean).join(" ") || "none"
  node.style.lineHeight = "1.35"
}

function hidePluginTextPanel() {
  const panel = document.getElementById("textInputPanel") as HTMLDivElement | null
  if (!panel) return
  panel.style.display = "none"
  panel.innerHTML = ""
  panel.blur()
}

function pinCanvasUnfocusable(pin: boolean) {
  const canvas = canvasEl()
  if (!canvas) return
  if (pin) {
    if (canvas.dataset.vesselTabIndex == null) canvas.dataset.vesselTabIndex = String(canvas.tabIndex)
    canvas.tabIndex = -1
    if (document.activeElement === canvas) canvas.blur()
  } else if (canvas.dataset.vesselTabIndex != null) {
    canvas.tabIndex = Number(canvas.dataset.vesselTabIndex) || 0
    delete canvas.dataset.vesselTabIndex
  }
}

/**
 * Install crop-click text editing. Returns disposer.
 */
export function installTextInputFocus(
  toolbar: HTMLElement,
  getCutBox: () => CutBox,
  hooks?: { focusWindow?: () => void; setTextEditing?: (editing: boolean) => void | Promise<void> }
) {
  const focusWindow = hooks?.focusWindow
  const setTextEditing = hooks?.setTextEditing
  const editor = ensureEditor()
  let session: EditorSession | null = null
  let lastOpenAt = 0
  let composing = false
  let windowFocusedOnce = false
  let textEditingOn = false

  /** Must finish before focus when turning on — otherwise screen-saver level still covers IME. */
  const applyTextEditing = async (on: boolean) => {
    if (textEditingOn === on) return
    textEditingOn = on
    try {
      await Promise.resolve(setTextEditing?.(on))
    } catch {
      /* smoke / missing handler */
    }
  }

  /** Mac/Electron IME: compositionstart OR keyCode 229 / isComposing. */
  const imeBusy = (event?: KeyboardEvent | CompositionEvent | Event | null) => {
    if (composing) return true
    if (!event || !("isComposing" in event || "keyCode" in event)) return false
    const keyEvent = event as KeyboardEvent
    return !!keyEvent.isComposing || keyEvent.keyCode === 229
  }

  const softFocus = () => {
    pinCanvasUnfocusable(true)
    try {
      editor.focus({ preventScroll: true })
    } catch {
      editor.focus()
    }
  }

  /**
   * Hard focus for opening the box only.
   * Never call win/webContents.focus or setSelectionRange during IME — both cancel 拼音.
   */
  const focusEditor = (opts?: { raiseWindow?: boolean; placeCaret?: boolean }) => {
    const raiseWindow = opts?.raiseWindow === true
    const placeCaret = opts?.placeCaret === true
    pinCanvasUnfocusable(true)
    if (raiseWindow && !windowFocusedOnce) {
      windowFocusedOnce = true
      focusWindow?.()
    }
    softFocus()
    if (placeCaret && !composing) {
      const len = editor.value.length
      try {
        editor.setSelectionRange(len, len)
      } catch {
        /* ignore */
      }
    }
  }

  const hideEditor = () => {
    composing = false
    windowFocusedOnce = false
    editor.classList.remove("is-open")
    editor.style.display = "none"
    editor.value = ""
    session = null
    pinCanvasUnfocusable(false)
    void applyTextEditing(false)
    if (document.activeElement === editor) editor.blur()
  }

  const commit = () => {
    if (!session) {
      hideEditor()
      return
    }
    if (composing) return
    const text = editor.value.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n")
    const trimmed = text.replace(/\n+$/g, "")
    const { canvasX, canvasY, color, fontSize } = session
    hideEditor()
    if (!trimmed) return
    const canvas = canvasEl()
    const context = canvas?.getContext("2d")
    if (!context) return
    const api = shotApi()
    if (!api) return
    const metrics = measureText(trimmed, fontSize, context)
    const y = canvasY - metrics.lineHeight / 2
    pushHistory()
    api.addElement({
      x: canvasX,
      y,
      width: Math.max(1, metrics.width),
      height: Math.max(1, metrics.height),
      toolName: "vessel-text",
      payload: { text: trimmed, color, fontSize } satisfies TextPayload
    })
  }

  const openAt = (canvasX: number, canvasY: number, clientX: number, clientY: number) => {
    hidePluginTextPanel()
    if (session) commit()
    const color = readColor()
    const fontSize = readFontSize()
    session = { canvasX, canvasY, color, fontSize }
    composing = false
    windowFocusedOnce = false
    applyFormat(editor, color, fontSize)
    editor.value = ""
    editor.style.display = "block"
    editor.style.left = `${Math.round(clientX)}px`
    editor.style.top = `${Math.round(clientY - fontSize * 0.7)}px`
    editor.style.minWidth = "96px"
    editor.style.width = "96px"
    editor.style.height = `${Math.ceil(fontSize * 1.45)}px`
    editor.classList.add("is-open")
    // Await level drop before focus — race here keeps screen-saver covering 拼音候选窗.
    void applyTextEditing(true).then(() => {
      if (!session || !editor.classList.contains("is-open")) return
      focusEditor({ raiseWindow: true, placeCaret: true })
      requestAnimationFrame(() => {
        if (session && !composing) softFocus()
      })
    })
  }

  const onPointerDown = (event: PointerEvent) => {
    if (!isTextTool(toolbar)) return
    const target = event.target as Element | null
    // Clicks inside the editor must keep focus for typing / IME.
    if (target === editor || target?.closest?.("#vesselTextInput")) {
      event.stopPropagation()
      // softFocus mid-composition cancels 拼音选字.
      if (!composing) softFocus()
      return
    }
    if (target?.closest?.(CHROME)) {
      if (session && !target?.closest?.("#optionPanel")) {
        /* toolbar tool switch — commit below via sync observer */
      }
      return
    }
    if (event.button != null && event.button !== 0) return
    const box = getCutBox()
    const point = clientToCanvas(event.clientX, event.clientY)
    if (!point || !insideCrop(point.x, point.y, box)) {
      if (session && !composing) commit()
      return
    }
    // Own the click so the plugin cannot dismiss / steal focus.
    event.preventDefault()
    event.stopImmediatePropagation()
    const now = performance.now()
    if (now - lastOpenAt < 50) return
    lastOpenAt = now
    openAt(point.x, point.y, event.clientX, event.clientY)
  }

  /** After textarea handles the key, stop plugin body shortcuts (Enter=confirm, Backspace=delete). */
  const stopPluginKeys = (event: KeyboardEvent) => {
    if (!session || !editor.classList.contains("is-open")) return
    event.stopPropagation()
  }

  const onEditorKeyDown = (event: KeyboardEvent) => {
    if (!session) return
    // Always isolate from plugin body listeners; never preventDefault during IME.
    event.stopPropagation()
    if (imeBusy(event)) return
    if (event.key === "Escape") {
      event.preventDefault()
      hideEditor()
      return
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commit()
      return
    }
  }

  /**
   * Window capture: reclaim soft focus if needed; never preventDefault while composing
   * (Enter confirms 拼音, Backspace edits 拼音 — blocking them makes Chinese "unable to type").
   */
  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (!session || !editor.classList.contains("is-open")) return
    const busy = imeBusy(event)
    if (document.activeElement !== editor) {
      // Reclaim focus only when not composing; focus mid-IME drops the candidate window.
      if (!busy) softFocus()
      if (busy) return
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopImmediatePropagation()
        hideEditor()
        return
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        commit()
        return
      }
      // Block plugin shortcuts only when not composing and focus had drifted.
      if (event.key === "Enter" || event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
      return
    }
    if (busy) return
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopImmediatePropagation()
      hideEditor()
    }
  }

  /**
   * Body capture runs before target/bubble. While editor is open, stop the plugin's
   * body bubble Enter/Backspace handler without touching IME keys (no preventDefault).
   */
  const onBodyKeyDownCapture = (event: KeyboardEvent) => {
    if (!session || !editor.classList.contains("is-open")) return
    if (imeBusy(event)) {
      // Never focus() during composition — Electron panel IME cancels 拼音 on focus steal.
      return
    }
    const target = event.target as Node | null
    if (target === editor || editor.contains(target)) return
    if (event.key === "Enter" || event.key === "Backspace" || event.key === "Delete" || event.key === "Escape") {
      // Same-element: stopImmediatePropagation also blocks body bubble plugin handler.
      event.stopPropagation()
    }
  }

  const onCompositionStart = () => {
    composing = true
  }
  const onCompositionUpdate = () => {
    composing = true
    autosize()
  }
  const onCompositionEnd = () => {
    composing = false
    autosize()
    // Some Electron builds blur after compositionend — soft reclaim.
    requestAnimationFrame(() => {
      if (session && editor.classList.contains("is-open") && document.activeElement !== editor) softFocus()
    })
  }

  const autosize = () => {
    if (!session) return
    editor.style.height = "auto"
    editor.style.height = `${Math.max(session.fontSize * 1.45, editor.scrollHeight)}px`
    editor.style.width = "auto"
    const next = Math.max(96, Math.min(Math.ceil(editor.scrollWidth + 8), Math.floor(window.innerWidth - 16)))
    editor.style.width = `${next}px`
  }

  const onInput = () => autosize()

  const onBlur = () => {
    if (!session || !editor.classList.contains("is-open")) return
    // Do not softFocus while composing — macOS IME candidate UI blurs the textarea;
    // reclaiming focus here cancels 拼音. compositionend handles soft reclaim.
  }

  // Do NOT commit on blur: Electron panel + canvas tabIndex cause spurious blurs
  // that wiped the box before any text could be entered. Commit on outside click /
  // Ctrl+Enter / tool switch instead.

  window.addEventListener("pointerdown", onPointerDown, true)
  window.addEventListener("mousedown", onPointerDown as EventListener, true)
  window.addEventListener("keydown", onWindowKeyDown, true)
  document.body.addEventListener("keydown", onBodyKeyDownCapture, true)
  editor.addEventListener("keydown", onEditorKeyDown)
  editor.addEventListener("keyup", stopPluginKeys)
  editor.addEventListener("keypress", stopPluginKeys)
  editor.addEventListener("compositionstart", onCompositionStart)
  editor.addEventListener("compositionupdate", onCompositionUpdate)
  editor.addEventListener("compositionend", onCompositionEnd)
  editor.addEventListener("input", onInput)
  editor.addEventListener("blur", onBlur)
  // Capture-phase on editor also blocks body bubble listeners of the plugin.
  editor.addEventListener("keydown", stopPluginKeys, true)

  const sync = () => {
    if (isTextTool(toolbar)) hidePluginTextPanel()
    else if (session) commit()
    else hideEditor()
  }
  const observer = new MutationObserver(sync)
  observer.observe(toolbar, { attributes: true, subtree: true, attributeFilter: ["class"] })
  sync()

  return () => {
    window.removeEventListener("pointerdown", onPointerDown, true)
    window.removeEventListener("mousedown", onPointerDown as EventListener, true)
    window.removeEventListener("keydown", onWindowKeyDown, true)
    document.body.removeEventListener("keydown", onBodyKeyDownCapture, true)
    editor.removeEventListener("keydown", onEditorKeyDown)
    editor.removeEventListener("keyup", stopPluginKeys)
    editor.removeEventListener("keypress", stopPluginKeys)
    editor.removeEventListener("keydown", stopPluginKeys, true)
    editor.removeEventListener("compositionstart", onCompositionStart)
    editor.removeEventListener("compositionupdate", onCompositionUpdate)
    editor.removeEventListener("compositionend", onCompositionEnd)
    editor.removeEventListener("input", onInput)
    editor.removeEventListener("blur", onBlur)
    observer.disconnect()
    hideEditor()
    editor.remove()
  }
}
