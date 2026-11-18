import type { ElementStyleSnapshot } from "./element-style-snapshot"
import stylesScript from "./element-picker-styles.tsx?guest-script"

/** Runs in the guest page without Node access; page data is assigned as text only. */
function pickElement(mountStyles: (container: HTMLElement, read: () => ElementStyleSnapshot, inspect: (name: string) => void) => () => void, readStyles: (element: Element) => ElementStyleSnapshot) {
  const id = "vessel-element-picker"
  const existing = document.getElementById(id)
  if (existing) {
    existing.dispatchEvent(new Event("vessel-close"))
    return
  }
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
    .remove{display:none;margin-left:auto;border:1px solid #bbf7d0;border-radius:5px;background:#f0fdf4;color:#15803d;cursor:pointer;font:600 10.5px/1 inherit;padding:3px 8px}.remove:hover{background:#16a34a;color:#fff}
    .actions{position:fixed;top:12px;left:12px;width:340px;max-width:calc(100vw - 24px);pointer-events:auto;background:#fff;color:#44403c;border:1px solid #ddd;border-radius:10px;padding:10px;box-shadow:0 8px 30px #0002;font:12px/1.5 system-ui}
    .actions[hidden],.copy-menu[hidden]{display:none}.tools{display:flex;gap:6px;align-items:center}.tools button{position:relative;display:grid;place-items:center;width:30px;height:30px;border:1px solid #e7e5e4;border-radius:6px;background:#fff;color:#57534e;cursor:pointer}.tools button:hover{background:#f0fdf4;color:#16a34a}.tools button[data-title]:is(:hover,:focus-visible)::after{content:attr(data-title);position:absolute;top:calc(100% + 6px);left:0;z-index:4;white-space:nowrap;padding:4px 7px;border:1px solid #e2e8f0;border-radius:5px;background:#334155;color:#fff;font:10px/1.5 system-ui;pointer-events:none;box-shadow:0 2px 8px #0002}.tools button.danger{background:#dc2626;border-color:#dc2626;color:#fff}.tools button.danger:hover{background:#b91c1c;border-color:#b91c1c;color:#fff}.tools svg{width:16px;height:16px}.styles-collapsible{margin-top:10px;border-top:1px solid #e8edf2;padding-top:6px}.styles-trigger{display:flex;align-items:center;gap:7px;width:100%;border:0;border-radius:6px;padding:7px 3px;background:transparent;color:#334155;font:500 11px/1.5 system-ui;cursor:pointer;text-align:left}.styles-trigger:hover{background:#f8fafc}.styles-trigger:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}.styles-chevron{width:13px;height:13px;flex-shrink:0;transition:transform .15s}.styles-trigger[data-state=open] .styles-chevron,.style-group-trigger[data-state=open] .styles-chevron,.style-source-trigger[data-state=open] .styles-chevron{transform:rotate(90deg)}.styles-subtitle{color:#94a3b8;font-size:10px}.styles-count{margin-left:auto;border-radius:4px;background:#eff6ff;color:#2563eb;padding:0 5px;font-size:10px}.styles-content{overflow:hidden}.all-styles{position:relative;overflow:hidden;height:min(40vh,340px);margin-top:5px;border:1px solid #e8edf2;border-radius:7px;background:#fbfcfe;font:10.5px/1.7 ui-monospace,Menlo,monospace}.all-styles [data-radix-scroll-area-viewport]{width:100%;height:100%;border-radius:inherit}.all-styles [data-orientation=vertical]{display:flex;touch-action:none;user-select:none;width:9px;padding:2px;border-left:1px solid transparent}.all-styles [data-orientation=vertical]>div{position:relative;flex:1;background:#cbd5e1;border-radius:999px}.all-styles [data-orientation=vertical]>div:hover{background:#94a3b8}.style-group-trigger{display:flex;align-items:center;gap:6px;width:100%;border:0;border-bottom:1px solid #e8edf2;background:#f1f5f9;padding:6px 10px;color:#475569;font:600 10.5px/1.6 system-ui;text-align:left;cursor:pointer;position:sticky;top:0;z-index:1}.style-group-trigger:hover{background:#eaf1fa}.style-group-trigger:focus-visible{outline:2px solid #93c5fd;outline-offset:-2px}.style-group-trigger .styles-count{background:#fff;color:#64748b}.style-source-trigger{display:flex;align-items:center;gap:6px;width:100%;border:0;border-bottom:1px solid #e2e8f0;background:#eaf1fa;color:#334155;padding:8px 9px;font:600 11px/1.6 system-ui;text-align:left;cursor:pointer}.style-source-trigger:hover{background:#e2ecfa}.style-source-trigger:focus-visible{outline:2px solid #93c5fd;outline-offset:-2px}.style-source .style-group-trigger{padding-left:18px}.styles-empty,.styles-note{margin:0;padding:8px 10px;color:#94a3b8;font:10px/1.7 system-ui}.style-row{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:10px;padding:5px 12px 5px 9px;border-bottom:1px solid #edf1f5;align-items:start}.style-row:last-child{border-bottom:0}.style-row:hover{background:#eff6ff}.style-row span{overflow-wrap:anywhere}.style-property{color:#2563eb}.style-value{min-width:0;padding:0;border:0;background:transparent;text-align:left;color:#7c3aed;font:inherit;cursor:pointer;overflow-wrap:anywhere}.style-value:hover{background:#dbeafe;box-shadow:0 0 0 3px #dbeafe;border-radius:2px}.style-value:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}.style-token-number{color:#b45309}.style-token-color{color:#059669}.style-token-string{color:#be185d}.style-punctuation{color:#94a3b8}.copy-menu{position:absolute;top:48px;left:10px;z-index:2;width:200px;padding:5px;border:1px solid #ddd;border-radius:8px;background:white;box-shadow:0 6px 20px #0002}.copy-menu button{display:block;width:100%;padding:6px 8px;text-align:left;border:0;background:white;border-radius:4px;color:#44403c;cursor:pointer}.copy-menu button:hover{background:#eff6ff}.action-status{font-size:10px;color:#16a34a;margin-top:5px}
    .footer{display:flex;align-items:center}.pinned .remove{display:inline-block}
    .pinned{pointer-events:auto;border-color:#93c5fd;box-shadow:0 8px 30px #2563eb26}.pinned .close{display:block}
  `
  const box = document.createElement("div")
  box.className = "box"
  const card = document.createElement("div")
  card.className = "card"
  card.hidden = true
  const selector = document.createElement("div")
  selector.className = "selector"
  const exit = document.createElement("button")
  exit.className = "close"
  exit.textContent = "×"
  exit.setAttribute("aria-label", "退出元素检查")
  card.append(selector, exit)
  const values = ["尺寸", "颜色", "字体", "内边距", "名称", "角色"].map((label) => {
    const row = document.createElement("div")
    row.className = "row"
    const title = document.createElement("span")
    title.className = "label"
    title.textContent = label
    const value = document.createElement("span")
    value.className = "value" + (["尺寸", "字体", "内边距"].includes(label) ? " mono" : "")
    row.append(title, value)
    card.append(row)
    return value
  })
  const footer = document.createElement("div")
  footer.className = "footer"
  const hint = document.createElement("span")
  hint.className = "hint"
  hint.textContent = "点击固定"
  const remove = document.createElement("button")
  remove.className = "remove"
  remove.textContent = "操作元素"
  remove.setAttribute("aria-label", "操作当前元素")
  footer.append(hint, document.createTextNode("\u00a0 ·\u00a0 Esc 退出"), remove)
  card.append(footer)
  shadow.append(css, box, card)
  document.documentElement.append(host)
  let frozen = false
  let target: Element | null = null

  const actions = document.createElement("section")
  actions.className = "actions"
  actions.hidden = true
  actions.setAttribute("aria-label", "元素操作工具栏")
  const tools = document.createElement("div")
  tools.className = "tools"
  const stylesContainer = document.createElement("div")
  const copyMenu = document.createElement("div")
  copyMenu.className = "copy-menu"
  copyMenu.hidden = true
  copyMenu.setAttribute("role", "menu")
  const status = document.createElement("p")
  status.className = "action-status"
  status.setAttribute("role", "status")
  const styleText = () => {
    if (!target?.isConnected) return ""
    const computed = target.ownerDocument.defaultView!.getComputedStyle(target)
    return Array.from(computed).map((name) => `${name}: ${computed.getPropertyValue(name)};`).join("\n")
  }
  let unmountStyles: (() => void) | undefined
  const selectorPath = () => {
    const parts: string[] = []
    let node = target
    while (node) {
      const escapedId = node.id && (window.CSS?.escape ? window.CSS.escape(node.id) : node.id.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`))
      if (escapedId) { parts.unshift(`#${escapedId}`); break }
      const peers = node.parentElement ? Array.from(node.parentElement.children).filter((child) => child.tagName === node!.tagName) : []
      parts.unshift(node.tagName.toLowerCase() + (peers.length > 1 ? `:nth-of-type(${peers.indexOf(node) + 1})` : ""))
      node = node.parentElement
    }
    return parts.join(" > ")
  }
  const xpath = (full: boolean) => {
    const parts: string[] = []
    let node = target
    if (!full && node?.id) {
      const value = node.id
      const literal = !value.includes('"') ? `"${value}"` : !value.includes("'") ? `'${value}'` : `concat(${value.split('"').map((part) => `"${part}"`).join(', \'"\', ')})`
      return `//*[@id=${literal}]`
    }
    while (node) {
      const peers = node.parentElement ? Array.from(node.parentElement.children).filter((child) => child.tagName === node!.tagName) : [node]
      parts.unshift(`${node.tagName.toLowerCase()}[${peers.indexOf(node) + 1}]`)
      node = node.parentElement
    }
    return "/" + parts.join("/")
  }
  for (const [label, read] of [
    ["复制元素", () => target?.outerHTML || ""], ["复制 outerHTML", () => target?.outerHTML || ""],
    ["复制 selector", selectorPath], ["复制 JS 路径", () => `document.querySelector(${JSON.stringify(selectorPath())})`],
    ["复制样式", styleText], ["复制 XPath", () => xpath(false)], ["复制完整 XPath", () => xpath(true)]
  ] as const) {
    const button = document.createElement("button")
    button.textContent = label
    button.setAttribute("role", "menuitem")
    button.addEventListener("click", async () => {
      if (!target?.isConnected) { status.textContent = "元素已不在页面中"; return }
      try { await navigator.clipboard.writeText(read()); status.textContent = "已复制"; copyMenu.hidden = true }
      catch { status.textContent = "复制失败，请检查剪贴板权限" }
    })
    copyMenu.append(button)
  }
  const tool = (label: string, path: string, handler: () => void) => {
    const button = document.createElement("button")
    button.setAttribute("aria-label", label); button.dataset.title = label
    // Only static application-owned SVG paths enter markup; element data uses textContent.
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${path}</svg>`
    button.addEventListener("click", handler); tools.append(button)
    return button
  }
  tool("复制元素", '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>', () => { copyMenu.hidden = !copyMenu.hidden })
  const hiddenStyles = new WeakMap<Element, [string, string]>()
  const hideButton = tool("隐藏元素", '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="m3 3 18 18"/>', () => {
    if (!target || !("style" in target)) { status.textContent = "此元素不支持隐藏"; return }
    const element = target as HTMLElement | SVGElement
    const previous = hiddenStyles.get(element)
    if (previous) {
      if (previous[0]) element.style.setProperty("visibility", previous[0], previous[1])
      else element.style.removeProperty("visibility")
      hiddenStyles.delete(element)
      hideButton.dataset.title = "隐藏元素"
      status.textContent = "已显示元素"
    } else {
      hiddenStyles.set(element, [element.style.getPropertyValue("visibility"), element.style.getPropertyPriority("visibility")])
      element.style.setProperty("visibility", "hidden", "important")
      hideButton.dataset.title = "显示元素"
      status.textContent = "已隐藏元素，再次点击可恢复"
    }
    hideButton.setAttribute("aria-label", hideButton.dataset.title!)
    hideButton.setAttribute("aria-pressed", String(hiddenStyles.has(element)))
  })
  const deleteButton = tool("删除元素", '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>', () => {
    if (!target?.isConnected || target === target.ownerDocument.documentElement || target === target.ownerDocument.body) { status.textContent = "不能删除页面根节点"; return }
    target.remove(); target = null; box.style.cssText = ""; status.textContent = "已删除元素；刷新网页可恢复"
  })
  deleteButton.className = "danger"
  tool("关闭元素操作", '<path d="m6 6 12 12M18 6 6 18"/>', () => close())
  actions.append(tools, stylesContainer, status, copyMenu)
  shadow.append(actions)
  remove.addEventListener("click", () => {
    if (!unmountStyles && target) unmountStyles = mountStyles(stylesContainer, () => target?.isConnected ? readStyles(target) : { user: [], system: [], unreadableSheets: false }, (property) => {
      if (!target?.isConnected) return
      const key = "__vesselStyleTarget_" + Math.random().toString(36).slice(2)
      Object.defineProperty(window, key, { value: target, configurable: true })
      setTimeout(() => { Reflect.deleteProperty(window, key) }, 15000)
      close()
      const bridge = window as Window & { vesselInspectStyle?: (request: { property: string; targetKey: string }) => void }
      bridge.vesselInspectStyle?.({ property, targetKey: key })
    })
    actions.hidden = false; card.hidden = true; copyMenu.hidden = true })

  const documents = new Set<Document>()
  const frames = new Set<HTMLIFrameElement>()
  const observers: MutationObserver[] = []
  // Translate frame-local coordinates into the top document's viewport.
  const offset = (doc: Document) => {
    let x = 0, y = 0
    let view = doc.defaultView
    while (view && view !== window) {
      const frame = view.frameElement as HTMLElement | null
      if (!frame) break
      const rect = frame.getBoundingClientRect()
      x += rect.left + frame.clientLeft
      y += rect.top + frame.clientTop
      view = frame.ownerDocument.defaultView
    }
    return { x, y }
  }

  /** Draws draw. */
  const draw = () => {
    if (!target?.isConnected) return
    const rect = target.getBoundingClientRect()
    const origin = offset(target.ownerDocument)
    Object.assign(box.style, { left: `${rect.left + origin.x}px`, top: `${rect.top + origin.y}px`, width: `${rect.width}px`, height: `${rect.height}px` })
  }

  /** Shows show. */
  const show = (event: MouseEvent) => {
    if (frozen) return
    const hit = event.composedPath()[0]
    if (!hit || (hit as Node).nodeType !== 1 || hit === host) return
    const picked = hit as Element
    target = picked
    draw()
    const element = picked
    const rect = element.getBoundingClientRect(),
      style = element.ownerDocument.defaultView!.getComputedStyle(element)
    selector.textContent =
      element.tagName.toLowerCase() +
      (element.id ? "#" + element.id : "") +
      Array.from(element.classList)
        .slice(0, 2)
        .map((c) => "." + c)
        .join("")
    values[0].textContent = `${rect.width.toFixed(1)} × ${rect.height.toFixed(1)}`
    const swatch = document.createElement("span")
    swatch.className = "swatch"
    swatch.style.backgroundColor = style.color
    values[1].replaceChildren(swatch, document.createTextNode(style.color))
    values[2].textContent = `${style.fontSize} ${style.fontFamily}`.slice(0, 80)
    values[3].textContent = style.padding
    values[4].textContent = (element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent?.trim() || "(无文本)").slice(0, 60)
    values[5].textContent = element.getAttribute("role") || element.tagName.toLowerCase()
    card.hidden = false
    const origin = offset(element.ownerDocument)
    card.style.left = `${Math.max(8, Math.min(event.clientX + origin.x + 16, innerWidth - card.offsetWidth - 8))}px`
    card.style.top = `${Math.max(8, Math.min(event.clientY + origin.y + 16, innerHeight - card.offsetHeight - 8))}px`
  }

  /** Performs the click operation. */
  const click = (event: MouseEvent) => {
    if (event.target === host) return
    if (event.composedPath().includes(exit)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      close()
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    if (!target || frozen) return
    frozen = true
    card.classList.add("pinned")
    hint.textContent = "已固定"
    box.style.outlineColor = "#2563eb"
    box.style.background = "rgba(37,99,235,.06)"
  }

  /** Closes close. */
  const close = () => {
    observers.forEach((observer) => observer.disconnect())
    frames.forEach((frame) => frame.removeEventListener("load", frameLoaded))
    documents.forEach((doc) => {
      doc.removeEventListener("mousemove", show, true)
      doc.removeEventListener("click", click, true)
      doc.removeEventListener("keydown", key, true)
      doc.removeEventListener("scroll", draw, true)
    })
    window.removeEventListener("scroll", draw, true)
    window.removeEventListener("resize", draw)
    unmountStyles?.()
    host.remove()
  }

  /** Performs the key operation. */
  const key = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!copyMenu.hidden) { copyMenu.hidden = true; return }
      close()
    }
  }
  exit.addEventListener("click", close)
  host.addEventListener("vessel-close", close)
  const frameLoaded = () => scan(document)
  function scan(doc: Document) {
    if (!documents.has(doc)) {
      documents.add(doc)
      doc.addEventListener("mousemove", show, true)
      doc.addEventListener("click", click, true)
      doc.addEventListener("keydown", key, true)
      doc.addEventListener("scroll", draw, true)
      const observer = new MutationObserver(() => scan(doc))
      observer.observe(doc, { childList: true, subtree: true })
      observers.push(observer)
    }
    doc.querySelectorAll("iframe").forEach((frame) => {
      if (!frames.has(frame)) {
        frames.add(frame)
        frame.addEventListener("load", frameLoaded)
      }
      try {
        if (frame.contentDocument) scan(frame.contentDocument)
      } catch { /* Cross-origin documents require Chromium DevTools inspection. */ }
    })
  }
  scan(document)
  window.addEventListener("scroll", draw, true)
  window.addEventListener("resize", draw)
}
export const elementPickerScript = `(() => { ${stylesScript}; (${pickElement.toString()})(VesselGuest.mount, VesselGuest.readElementStyles); })()`
