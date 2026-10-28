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
  const click = (event: MouseEvent) => {
    const tool = (event.target as Element).closest<HTMLElement>(".item-panel")
    if (tool && Number(tool.dataset.id) >= 1 && Number(tool.dataset.id) <= 6) selected = tool
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
