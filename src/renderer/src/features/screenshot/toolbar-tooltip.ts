import { installLiquidGlass } from "./liquid-glass"
/** Delegated hints keep the library's data-title command keys intact. */
export function installToolbarTooltip(toolbar: HTMLElement) {
  const tip = document.createElement("div")
  tip.className = "shot-toolbar-tooltip"
  tip.id = "shot-toolbar-tooltip"
  tip.setAttribute("role", "tooltip")
  tip.hidden = true
  document.body.append(tip)
  const stopGlass = installLiquidGlass(tip)
  let active: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let previousDescription: string | null = null
  const hide = () => {
    clearTimeout(timer)
    tip.hidden = true
    if (active) {
      if (previousDescription === null) active.removeAttribute("aria-describedby")
      else active.setAttribute("aria-describedby", previousDescription)
    }
    active = null
  }
  const labels: [string, string][] = [
    [".square", "矩形"], [".round", "椭圆"], [".right-top", "箭头"],
    [".brush", "画笔"], [".mosaicPen", "马赛克"], [".text", "文字"],
    [".undo, .undo-disabled", "撤销"], [".save", "下载截图"], [".close", "取消截图"],
    [".confirm", "完成并复制"], [".shot-step", "步骤标注"], [".shot-pin", "固定到屏幕"],
    [".shot-mode-trigger", "选择截图 / OCR / 翻译"], [".shot-toolbar-grip", "按住拖动工具栏"]
  ]
  const enter = (event: Event) => {
    const target = (event.target as Element).closest<HTMLElement>(".item-panel:not(.separateLine), .shot-mode-trigger, .shot-toolbar-grip")
    if (!target || target === active || !toolbar.contains(target)) return
    hide()
    const match = labels.find(([selector]) => target.matches(selector) || target.querySelector(selector))
    if (!match) return
    const confirm = target.matches(".confirm") ? target : target.querySelector<HTMLElement>(".confirm")
    const label = confirm?.getAttribute("aria-label") || match[1]
    // Prevent the native title tooltip from appearing over the custom hint.
    target.removeAttribute("title")
    target.querySelectorAll("[title]").forEach((node) => node.removeAttribute("title"))
    active = target
    previousDescription = target.getAttribute("aria-describedby")
    timer = setTimeout(() => {
      if (!active) return
      const text = document.createElement("span")
      text.textContent = label
      tip.replaceChildren(text)
      if (match[0] === ".close") {
        const key = document.createElement("kbd")
        key.textContent = "Esc"
        tip.append(key)
      }
      tip.hidden = false
      const rect = active.getBoundingClientRect()
      const bounds = tip.getBoundingClientRect()
      tip.style.left = `${Math.max(8, Math.min(innerWidth - bounds.width - 8, rect.left + rect.width / 2 - bounds.width / 2))}px`
      tip.style.top = `${rect.top >= bounds.height + 12 ? rect.top - bounds.height - 10 : Math.min(innerHeight - bounds.height - 8, rect.bottom + 10)}px`
      active.setAttribute("aria-describedby", tip.id)
    }, 180)
  }
  toolbar.addEventListener("mouseover", enter)
  toolbar.addEventListener("focusin", enter)
  toolbar.addEventListener("mouseleave", hide)
  toolbar.addEventListener("focusout", hide)
  toolbar.addEventListener("pointerdown", hide)
  window.addEventListener("vessel:screenshot-toolbar-moved", hide)
  return () => {
    hide()
    stopGlass()
    tip.remove()
    toolbar.removeEventListener("mouseover", enter)
    toolbar.removeEventListener("focusin", enter)
    toolbar.removeEventListener("mouseleave", hide)
    toolbar.removeEventListener("focusout", hide)
    toolbar.removeEventListener("pointerdown", hide)
    window.removeEventListener("vessel:screenshot-toolbar-moved", hide)
  }
}
