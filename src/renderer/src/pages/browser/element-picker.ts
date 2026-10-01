/** Runs in the guest page without Node access; never interpolates page HTML. */
function pickElement() {
  const id = "vessel-element-picker"
  const existing = document.getElementById(id)
  if (existing) { existing.dispatchEvent(new Event("vessel-close")); return }
  const host = document.createElement("div")
  host.id = id
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none"
  const shadow = host.attachShadow({ mode: "closed" })
  const box = document.createElement("div")
  box.style.cssText = "position:fixed;background:#38bdf833;outline:2px solid #38bdf8;pointer-events:none"
  const card = document.createElement("div")
  card.style.cssText = "position:fixed;box-sizing:border-box;max-width:380px;padding:12px;background:white;color:#222;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 20px #0003;font:13px/1.6 sans-serif;white-space:pre-wrap;overflow-wrap:anywhere"
  shadow.append(box, card)
  document.documentElement.append(host)
  let frozen = false
  const show = (event: MouseEvent) => {
    if (frozen) return
    const element = event.composedPath()[0]
    if (!(element instanceof Element)) return
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    box.style.left = `${rect.left}px`; box.style.top = `${rect.top}px`
    box.style.width = `${rect.width}px`; box.style.height = `${rect.height}px`
    const name = element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 100) || "—"
    card.textContent = `${element.tagName.toLowerCase()}${element.id ? "#" + element.id : ""}${Array.from(element.classList).map(c => "." + c).join("")}\n${rect.width.toFixed(1)} × ${rect.height.toFixed(1)}\n颜色：${style.color}\n字体：${style.fontSize} ${style.fontFamily}\n内边距：${style.padding}\n名称：${name}\n角色：${element.getAttribute("role") || element.tagName.toLowerCase()}\n点击固定 · Esc 退出`
    card.style.left = `${Math.max(8, Math.min(event.clientX + 16, innerWidth - 388))}px`
    card.style.top = `${Math.max(8, Math.min(event.clientY + 20, innerHeight - card.offsetHeight - 8))}px`
  }
  const click = (event: MouseEvent) => { event.preventDefault(); event.stopImmediatePropagation(); show(event); frozen = true }
  const close = () => {
    document.removeEventListener("mousemove", show, true)
    document.removeEventListener("click", click, true)
    document.removeEventListener("keydown", key, true)
    host.remove()
  }
  const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close() } }
  host.addEventListener("vessel-close", close)
  document.addEventListener("mousemove", show, true)
  document.addEventListener("click", click, true)
  document.addEventListener("keydown", key, true)
}
export const elementPickerScript = `(${pickElement.toString()})()`
