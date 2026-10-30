import { installLiquidGlass } from "./liquid-glass"
const format = { bold: false, italic: false, underline: false, strike: false, family: "sans-serif" }
export function screenshotTextFont(value: string) {
  if (!/\bnone$/.test(value)) return value
  const size = /[\d.]+px/.exec(value)?.[0] || "16px"
  return `${format.italic ? "italic " : ""}${format.bold ? "700" : "400"} ${size} "Vessel Screenshot Text", ${format.family}`
}
export function drawScreenshotTextDecoration(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  if (!context.font.includes("Vessel Screenshot Text") || (!format.underline && !format.strike)) return
  const size = parseFloat(/[\d.]+px/.exec(context.font)?.[0] || "16")
  const width = context.measureText(text).width
  context.save()
  context.strokeStyle = context.fillStyle
  context.lineWidth = Math.max(1, size / 16)
  context.beginPath()
  for (const offset of [format.underline ? size * .4 : null, format.strike ? 0 : null]) {
    if (offset === null) continue
    context.moveTo(x, y + offset)
    context.lineTo(x + width, y + offset)
  }
  context.stroke()
  context.restore()
}

export function installTextOptions(toolbar: HTMLElement, panel: HTMLElement) {
  const controls = document.createElement("div")
  controls.className = "shot-text-controls"
  const more = document.createElement("button")
  more.type = "button"; more.className = "shot-text-more"; more.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>'; more.setAttribute("aria-label", "展开文字选项")
  more.setAttribute("aria-expanded", "false")
  const advanced = document.createElement("div")
  advanced.className = "shot-text-advanced"; advanced.hidden = true
  const family = document.createElement("details")
  family.className = "shot-text-format shot-font-picker"
  const familySummary = document.createElement("summary")
  familySummary.textContent = "默认字体 ⌄"; familySummary.setAttribute("aria-label", "选择字体")
  const familyList = document.createElement("div")
  familyList.className = "shot-text-format-menu shot-font-menu"
  familyList.setAttribute("role", "menu"); familyList.setAttribute("aria-label", "字体")
  family.append(familySummary, familyList)
  const menu = document.createElement("details")
  menu.className = "shot-text-format"
  const summary = document.createElement("summary")
  summary.className = "shot-format-icon"
  summary.setAttribute("aria-label", "文字格式")
  summary.setAttribute("title", "文字格式")
  summary.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h7m4 0h5M4 12h3m4 0h9M4 18h11m4 0h1"/><circle cx="13" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg><span class="shot-menu-chevron" aria-hidden="true"></span>'
  const list = document.createElement("div"); list.className = "shot-text-format-menu"
  const updateInput = () => {
    const input = document.querySelector<HTMLElement>('#textInput, [contenteditable="true"]')
    if (!input) return
    input.style.fontWeight = format.bold ? "700" : "400"
    input.style.fontStyle = format.italic ? "italic" : "normal"
    input.style.fontFamily = format.family
    input.style.textDecoration = [format.underline ? "underline" : "", format.strike ? "line-through" : ""].filter(Boolean).join(" ") || "none"
  }
  for (const [label, value] of [["默认字体", "sans-serif"], ["衬线字体", "serif"], ["等宽字体", "monospace"]]) {
    const option = document.createElement("button")
    option.type = "button"; option.textContent = label; option.setAttribute("role", "menuitemradio")
    option.setAttribute("aria-checked", String(format.family === value))
    if (format.family === value) familySummary.textContent = `${label} ⌄`
    option.onclick = () => {
      format.family = value; updateInput(); familySummary.textContent = `${label} ⌄`
      familyList.querySelectorAll("button").forEach((item) => item.setAttribute("aria-checked", String(item === option)))
      family.open = false; familySummary.focus()
    }
    familyList.append(option)
  }
  family.addEventListener("toggle", () => {
    if (family.open) { menu.open = false; familyList.querySelector<HTMLElement>('[aria-checked="true"]')?.focus() }
  })
  familyList.onkeydown = (event) => {
    const items = Array.from(familyList.querySelectorAll("button"))
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus()
    }
  }
  const dismiss = (event: Event) => {
    if (event instanceof KeyboardEvent) {
      if (event.key !== "Escape") return
      if (family.open) { event.preventDefault(); event.stopImmediatePropagation(); family.open = false; familySummary.focus() }
      else if (menu.open) { event.preventDefault(); event.stopImmediatePropagation(); menu.open = false; summary.focus() }
    } else if (!controls.contains(event.target as Node)) { family.open = false; menu.open = false }
  }
  document.addEventListener("pointerdown", dismiss, true)
  window.addEventListener("keydown", dismiss, true)
  for (const [key, label, icon] of [["bold", "加粗", "B"], ["italic", "斜体", "Ⅰ"], ["underline", "下划线", "U"], ["strike", "删除线", "S"]] as const) {
    const button = document.createElement("button")
    button.type = "button"; button.textContent = `${icon}　${label}`; button.setAttribute("aria-pressed", String(format[key]))
    button.onclick = () => { format[key] = !format[key]; button.setAttribute("aria-pressed", String(format[key])); updateInput() }
    list.append(button)
  }
  menu.append(summary, list); advanced.append(family, menu)
  familyList.id = "shot-font-menu"; list.id = "shot-format-menu"
  const stopFontGlass = installLiquidGlass(familyList)
  const stopFormatGlass = installLiquidGlass(list)
  menu.addEventListener("toggle", () => { if (menu.open) family.open = false })
  more.onclick = () => { advanced.hidden = !advanced.hidden; more.setAttribute("aria-expanded", String(!advanced.hidden)); window.dispatchEvent(new Event("vessel:screenshot-toolbar-moved")) }
  controls.append(advanced, more); panel.append(controls)
  controls.addEventListener("pointerdown", (event) => event.stopPropagation())
  controls.addEventListener("click", (event) => event.stopPropagation())
  const sync = () => { panel.dataset.textOptions = String(!!toolbar.querySelector(".text-active")) }
  const observer = new MutationObserver(sync)
  observer.observe(toolbar, { attributes: true, subtree: true, attributeFilter: ["class"] })
  const sizeMenu = panel.querySelector<HTMLElement>(".text-select-panel")
  const sizeButton = panel.querySelector<HTMLElement>(".text-size-panel")
  const syncSize = () => {
    if (sizeMenu && sizeButton) sizeButton.setAttribute("aria-expanded", String(!sizeMenu.hidden && getComputedStyle(sizeMenu).display !== "none"))
  }
  const sizeObserver = new MutationObserver(syncSize)
  if (sizeMenu) sizeObserver.observe(sizeMenu, { attributes: true, attributeFilter: ["style", "hidden", "class"] })
  syncSize()
  sync()
  return () => { sizeObserver.disconnect(); stopFontGlass(); stopFormatGlass(); document.removeEventListener("pointerdown", dismiss, true); window.removeEventListener("keydown", dismiss, true); observer.disconnect(); controls.remove(); delete panel.dataset.textOptions }
}
