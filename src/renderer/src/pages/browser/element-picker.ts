/** Runs in the guest page without Node access; page data is assigned as text only. */
function pickElement() {
  const id = "vessel-element-picker"
  const existing = document.getElementById(id)
  if (existing) { existing.dispatchEvent(new Event("vessel-close")); return }
  const host = document.createElement("div")
  host.id = id
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none"
  const shadow = host.attachShadow({ mode: "closed" })
  const css = document.createElement("style")
  css.textContent = `
    *{box-sizing:border-box} .box{position:fixed;background:rgba(22,163,74,.08);outline:2px solid #16a34a;outline-offset:-2px;pointer-events:none}
    .card{position:fixed;width:300px;max-width:calc(100vw - 16px);padding:10px 12px;background:#fff;color:#44403c;border:1px solid #e7e5e4;border-radius:10px;box-shadow:0 8px 30px #0000001f;font:12px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-wrap:anywhere;max-height:calc(100vh - 16px);overflow:auto}
    .selector{font:600 11.5px/1.6 ui-monospace,Menlo,monospace;color:#16a34a;padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid #f0efed;padding-right:12px}
    .row{display:flex;align-items:flex-start;gap:8px;padding:1px 0;font-size:11.5px}.label{color:#a8a29e;min-width:52px}.value{flex:1;min-width:0}.mono{font-family:ui-monospace,Menlo,monospace}
    .swatch{display:inline-block;width:12px;height:12px;border:1px solid #e7e5e4;border-radius:3px;vertical-align:middle;margin-right:5px}
    .footer{margin-top:7px;padding-top:6px;border-top:1px solid #f0efed;font-size:10.5px;color:#a8a29e}.hint{color:#2563eb;font-weight:600}
    .close{display:none;position:absolute;top:6px;right:6px;border:0;border-radius:5px;background:transparent;color:#a8a29e;cursor:pointer;width:20px;height:20px}.close:hover{background:#f5f5f4;color:#44403c}
    .pinned{pointer-events:auto;border-color:#93c5fd;box-shadow:0 8px 30px #2563eb26}.pinned .close{display:block}
  `
  const box = document.createElement("div"); box.className = "box"
  const card = document.createElement("div"); card.className = "card"; card.hidden = true
  const selector = document.createElement("div"); selector.className = "selector"
  const exit = document.createElement("button"); exit.className = "close"; exit.textContent = "×"; exit.setAttribute("aria-label", "退出元素检查")
  card.append(selector, exit)
  const values = ["尺寸", "颜色", "字体", "内边距", "名称", "角色"].map(label => {
    const row = document.createElement("div"); row.className = "row"
    const title = document.createElement("span"); title.className = "label"; title.textContent = label
    const value = document.createElement("span"); value.className = "value" + (["尺寸", "字体", "内边距"].includes(label) ? " mono" : "")
    row.append(title, value); card.append(row); return value
  })
  const footer = document.createElement("div"); footer.className = "footer"
  const hint = document.createElement("span"); hint.className = "hint"; hint.textContent = "点击固定"
  footer.append(hint, document.createTextNode("  ·  Esc 退出")); card.append(footer)
  shadow.append(css, box, card); document.documentElement.append(host)
  let frozen = false
  let target: Element | null = null
  const draw = () => {
    if (!target?.isConnected) return
    const rect = target.getBoundingClientRect()
    Object.assign(box.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
  }
  const show = (event: MouseEvent) => {
    if (frozen) return
    const element = event.composedPath()[0]
    if (!(element instanceof Element) || element === host) return
    target = element; draw()
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
    selector.textContent = element.tagName.toLowerCase() + (element.id ? "#" + element.id : "") + Array.from(element.classList).slice(0, 2).map(c => "." + c).join("")
    values[0].textContent = `${rect.width.toFixed(1)} × ${rect.height.toFixed(1)}`
    const swatch = document.createElement("span"); swatch.className = "swatch"; swatch.style.backgroundColor = style.color
    values[1].replaceChildren(swatch, document.createTextNode(style.color))
    values[2].textContent = `${style.fontSize} ${style.fontFamily}`.slice(0, 80)
    values[3].textContent = style.padding
    values[4].textContent = (element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent?.trim() || "(无文本)").slice(0, 60)
    values[5].textContent = element.getAttribute("role") || element.tagName.toLowerCase()
    card.hidden = false
    card.style.left = `${Math.max(8, Math.min(event.clientX + 16, innerWidth - card.offsetWidth - 8))}px`
    card.style.top = `${Math.max(8, Math.min(event.clientY + 16, innerHeight - card.offsetHeight - 8))}px`
  }
  const click = (event: MouseEvent) => {
    if (event.target === host) return
    if (event.composedPath().includes(exit)) { event.preventDefault(); event.stopImmediatePropagation(); close(); return }
    event.preventDefault(); event.stopImmediatePropagation()
    if (!target || frozen) return
    frozen = true; card.classList.add("pinned"); hint.textContent = "已固定"
    box.style.outlineColor = "#2563eb"; box.style.background = "rgba(37,99,235,.06)"
  }
  const close = () => {
    document.removeEventListener("mousemove", show, true); document.removeEventListener("click", click, true)
    document.removeEventListener("keydown", key, true); window.removeEventListener("scroll", draw, true); window.removeEventListener("resize", draw)
    host.remove()
  }
  const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close() } }
  exit.addEventListener("click", close)
  host.addEventListener("vessel-close", close)
  document.addEventListener("mousemove", show, true); document.addEventListener("click", click, true); document.addEventListener("keydown", key, true)
  window.addEventListener("scroll", draw, true); window.addEventListener("resize", draw)
}
export const elementPickerScript = `(${pickElement.toString()})()`
