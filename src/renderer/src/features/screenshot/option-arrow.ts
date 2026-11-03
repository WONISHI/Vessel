/** Align the library's option pointer using actual tool geometry, including our added heading. */
export function installOptionArrow(toolbar: HTMLElement) {
  let selected: HTMLElement | null = null
  let frame = 0
  const align = () => {
    frame = 0
    const arrow = document.getElementById("optionIcoController")
    const panel = document.getElementById("optionPanel")
    if (!selected || !arrow || !panel) return
    const tool = selected.getBoundingClientRect()
    const bar = toolbar.getBoundingClientRect()
    const width = panel.getBoundingClientRect().width
    const height = panel.getBoundingClientRect().height
    const center = tool.left + tool.width / 2
    const left = Math.max(8, Math.min(center - width / 2, innerWidth - width - 8))
    const above = bar.bottom + height + 10 > innerHeight && bar.top >= height + 10
    const top = above ? bar.top - height - 10 : Math.min(bar.bottom + 10, innerHeight - height - 8)
    const set = (node: HTMLElement, name: string, value: string) => {
      if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value, "important")
    }
    set(panel, "left", `${Math.round(left)}px`)
    set(panel, "top", `${Math.max(8, Math.round(top))}px`)
    set(arrow, "left", `${Math.round(Math.max(left + 18, Math.min(left + width - 18, center)) - 9)}px`)
    set(arrow, "top", `${Math.round(above ? top + height - 1 : top - 8)}px`)
    if (arrow.dataset.side !== (above ? "top" : "bottom")) arrow.dataset.side = above ? "top" : "bottom"

  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(align)
  }
  const isShapeTool = (tool: HTMLElement) => {
    const title = tool.dataset.title || ""
    return title === "square" || title === "round" || title === "triangle" || title === "line" || title === "diamond" || title === "形状" || tool.classList.contains("shot-shapes") || tool.classList.contains("square") || tool.classList.contains("round") || !!tool.querySelector(".square, .round")
  }
  const click = (event: MouseEvent) => {
    const tool = (event.target as Element).closest<HTMLElement>(".item-panel")
    if (!tool || !toolbar.contains(tool)) return
    if (isShapeTool(tool)) {
      selected = toolbar.querySelector<HTMLElement>(".shot-shapes") || tool
      schedule()
      return
    }
    const id = Number(tool.dataset.id)
    if (id >= 1 && id <= 6) {
      selected = tool
      // Close mode/shape secondaries and drop their held active tiles.
      if (document.body.dataset.shotSecondary === "mode" || document.body.dataset.shotSecondary === "shapes" || document.body.dataset.shotSecondary === "steps") {
        delete document.body.dataset.shotSecondary
      }
      window.dispatchEvent(new CustomEvent("vessel:screenshot-secondary", { detail: "options" }))
      const shapes = toolbar.querySelector<HTMLElement>(".shot-shapes")
      shapes?.classList.remove("shot-shapes-active")
      shapes?.setAttribute("aria-pressed", "false")
      shapes?.setAttribute("aria-expanded", "false")
    }
    schedule()
  }
  toolbar.addEventListener("click", click)
  window.addEventListener("resize", schedule)
  window.addEventListener("vessel:screenshot-toolbar-moved", schedule)
  const observer = new MutationObserver(schedule)
  observer.observe(toolbar, { attributes: true, attributeFilter: ["style"] })
  const panel = document.getElementById("optionPanel")
  if (panel) observer.observe(panel, { attributes: true, childList: true, subtree: true, attributeFilter: ["style"] })
  return () => {
    observer.disconnect()
    toolbar.removeEventListener("click", click)
    window.removeEventListener("resize", schedule)
    window.removeEventListener("vessel:screenshot-toolbar-moved", schedule)
    cancelAnimationFrame(frame)
  }
}
