import "@/components/ui/data-title-tooltip.css"

/** Installs one delegated tooltip layer for dynamically mounted data-title elements. */
export function installDataTitleTooltips() {
  const tooltip = document.createElement("div")
  tooltip.id = `vessel-data-title-${crypto.randomUUID()}`
  tooltip.className = "vessel-data-title-tooltip"
  tooltip.setAttribute("role", "tooltip")
  tooltip.hidden = true
  document.body.append(tooltip)
  let target: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let previousDescription: string | null = null
  let pointerX = 0

  /** Hides the layer and restores the target's existing accessibility description. */
  const hide = () => {
    clearTimeout(timer)
    if (target && !tooltip.hidden) {
      if (previousDescription === null) target.removeAttribute("aria-describedby")
      else target.setAttribute("aria-describedby", previousDescription)
    }
    target = null
    pointerX = 0
    tooltip.hidden = true
  }
  /** Positions a readable tooltip within the current viewport. */
  const show = () => {
    if (!target?.isConnected || !target.dataset.title?.trim()) return hide()
    tooltip.textContent = target.dataset.title
    tooltip.hidden = false
    const rect = target.getBoundingClientRect()
    const size = tooltip.getBoundingClientRect()
    const gap = 8

    const explicitSide = target.dataset.titleSide
    const isTopTab = Boolean(target.closest('[data-workspace-tab="true"], .browser-tabs'))
    let side = explicitSide || (isTopTab ? "bottom" : "top")
    if (side === "top" && rect.top - size.height - gap < gap && !explicitSide) {
      side = "bottom"
    }

    const centerX = pointerX > 0 && pointerX >= rect.left && pointerX <= rect.right ? pointerX : rect.left + rect.width / 2

    if (side === "top") {
      tooltip.dataset.side = "top"
      tooltip.style.left = `${Math.max(gap, Math.min(innerWidth - size.width - gap, centerX - size.width / 2))}px`
      tooltip.style.top = `${Math.max(gap, rect.top - size.height - gap)}px`
    } else if (side === "bottom") {
      tooltip.dataset.side = "bottom"
      tooltip.style.left = `${Math.max(gap, Math.min(innerWidth - size.width - gap, centerX - size.width / 2))}px`
      tooltip.style.top = `${Math.max(gap, Math.min(innerHeight - size.height - gap, rect.bottom + gap))}px`
    } else if (side === "left") {
      tooltip.dataset.side = "left"
      tooltip.style.left = `${Math.max(gap, rect.left - size.width - gap)}px`
      tooltip.style.top = `${Math.max(gap, Math.min(innerHeight - size.height - gap, rect.top + rect.height / 2 - size.height / 2))}px`
    } else {
      tooltip.dataset.side = "right"
      tooltip.style.left = `${Math.max(gap, Math.min(innerWidth - size.width - gap, rect.right + gap))}px`
      tooltip.style.top = `${Math.max(gap, Math.min(innerHeight - size.height - gap, rect.top + rect.height / 2 - size.height / 2))}px`
    }
    previousDescription = target.getAttribute("aria-describedby")
    target.setAttribute("aria-describedby", [previousDescription, tooltip.id].filter(Boolean).join(" "))
  }
  /** Resolves the innermost annotated element, including icons nested in buttons. */
  const enter = (event: Event) => {
    if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent && event.pointerType === "touch") return
    if (event instanceof MouseEvent) {
      pointerX = event.clientX
    }
    const next = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-title]") : null
    if (next === target) return
    hide()
    if (!next?.dataset.title?.trim()) return
    target = next
    timer = setTimeout(show, event.type === "focusin" ? 100 : 350)
  }
  /** Keeps the tooltip stable while the pointer moves across nested child elements. */
  const leave = (event: Event) => {
    const related = (event as MouseEvent | FocusEvent).relatedTarget
    if (related instanceof Node && target?.contains(related)) return
    hide()
  }
  /** Dismisses tooltips with Escape without consuming the application shortcut. */
  const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") hide() }
  document.addEventListener("pointerover", enter)
  document.addEventListener("pointerout", leave)
  document.addEventListener("focusin", enter)
  document.addEventListener("focusout", leave)
  document.addEventListener("pointerdown", hide, true)
  document.addEventListener("keydown", keydown)
  document.addEventListener("scroll", hide, true)
  window.addEventListener("resize", hide)
  return () => {
    hide()
    tooltip.remove()
    document.removeEventListener("pointerover", enter)
    document.removeEventListener("pointerout", leave)
    document.removeEventListener("focusin", enter)
    document.removeEventListener("focusout", leave)
    document.removeEventListener("pointerdown", hide, true)
    document.removeEventListener("keydown", keydown)
    document.removeEventListener("scroll", hide, true)
    window.removeEventListener("resize", hide)
  }
}
