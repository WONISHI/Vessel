/** Runs in the guest so the video retains its authenticated, blob or streaming source. */
export function floatingVideoGuest(command: "list" | "open" | "close" | "bounds", id?: number) {
  const popupId = "vessel-floating-video"
  const existing = document.getElementById(popupId)
  if (command === "bounds") {
    if (!existing) return null
    const { top, right, bottom, left } = existing.getBoundingClientRect()
    return { top, right, bottom, left, width: innerWidth, height: innerHeight }
  }
  const guest = window as Window & {
    __vesselVideoIds?: { ids: WeakMap<HTMLVideoElement, number>; next: number }
  }
  const registry = guest.__vesselVideoIds ??= { ids: new WeakMap(), next: 1 }
  const videos = Array.from(document.querySelectorAll("video"))
  const floating = existing?.shadowRoot?.querySelector("video")
  if (floating) videos.unshift(floating)
  const hasSource = (video: HTMLVideoElement) =>
    Boolean(video.currentSrc || video.srcObject || video.getAttribute("src"))
  if (command === "list") {
    return videos.filter(hasSource).map((video) => {
      let id = registry.ids.get(video)
      if (id === undefined) {
        id = registry.next++
        registry.ids.set(video, id)
      }
      return { id, floating: video === floating, duration: Number.isFinite(video.duration) ? video.duration : null, live: video.duration === Infinity, width: video.videoWidth, height: video.videoHeight }
    })
  }
  if (command === "close") {
    existing?.shadowRoot?.querySelector("button")?.click()
    return undefined
  }
  const video = videos.find((candidate) => registry.ids.get(candidate) === id)
  if (!video || !hasSource(video)) throw new Error("视频源已变化")
  if (video === floating) return undefined
  existing?.shadowRoot?.querySelector("button")?.click()

  const moveVideo = (parent: Node, anchor: Node | null) => {
    const container = parent as Node & { moveBefore?: (node: Node, anchor: Node | null) => void }
    if (typeof container.moveBefore === "function") container.moveBefore(video, anchor)
    else parent.insertBefore(video, anchor)
  }
  const parent = video.parentNode
  const next = video.nextSibling
  const style = video.getAttribute("style")
  const controls = video.controls
  const rate = video.playbackRate
  const popup = document.createElement("div")
  popup.id = popupId
  popup.popover = "manual"
  popup.setAttribute("role", "dialog")
  popup.setAttribute("aria-label", "悬浮视频")
  popup.style.cssText = "position:fixed;inset:auto;right:16px;bottom:16px;width:min(420px, calc(100vw - 32px));padding:0;margin:0;border:0;border-radius:12px;background:#16181c;color:#f4f4f5;box-shadow:0 0 0 1px #ffffff24,0 12px 36px #0007;overflow:hidden"
  const shadow = popup.attachShadow({ mode: "open" })
  const theme = new CSSStyleSheet()
  theme.replaceSync(`
    header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      box-shadow: inset 0 -1px #ffffff14;
      font: 600 13px system-ui, sans-serif;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }
    header:active { cursor: grabbing; }
    footer {
      display: flex;
      justify-content: flex-end;
      background: #16181c;
      box-shadow: inset 0 1px #ffffff14;
    }
    .resize-handle {
      width: 32px;
      height: 14px;
      border: 0;
      border-radius: 4px;
      color: #a1a1aa;
      font-size: 13px;
      cursor: ew-resize;
      touch-action: none;
    }
    header span {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    select, button {
      box-sizing: border-box;
      height: 28px;
      border: 1px solid #ffffff16;
      border-radius: 6px;
      background: #ffffff0d;
      color: inherit;
      color-scheme: dark;
      font: 500 12px system-ui, sans-serif;
      cursor: pointer;
    }
    select { padding-inline: 7px 3px; font-variant-numeric: tabular-nums; }
    option { background: #24262b; }
    button { width: 28px; padding: 0; font-size: 18px; line-height: 1; }
    select:hover, button:hover { background: #ffffff20; }
    select:focus-visible, button:focus-visible { outline: 2px solid #93c5fd; outline-offset: 1px; }
  `)
  shadow.adoptedStyleSheets = [theme]
  const bar = document.createElement("header")
  const title = document.createElement("span")
  const updateTitle = () => {
    const episode = /(^|\.)bilibili\.com$/.test(location.hostname)
      ? document.querySelector(".video-pod__item.active .title, #multi_page .list-box li.on .part")
      : null
    const label = episode?.getAttribute("title")?.trim()
      || episode?.textContent?.trim()
      || navigator.mediaSession?.metadata?.title?.trim()
      || video.title.trim()
      || document.title.trim()
      || "悬浮视频"
    popup.setAttribute("aria-label", label)
    title.textContent = label
    title.title = label
  }
  updateTitle()
  const titleTimer = window.setInterval(updateTitle, 1000)
  const speed = document.createElement("select")
  speed.setAttribute("aria-label", "播放速度")
  for (const value of [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6]) speed.add(new Option(`${value}×`, String(value)))
  speed.value = speed.querySelector(`option[value="${rate}"]`) ? String(rate) : "1"
  speed.onchange = () => { video.playbackRate = Number(speed.value) }
  const close = document.createElement("button")
  close.type = "button"
  close.textContent = "×"
  close.setAttribute("aria-label", "关闭悬浮视频")
  close.onclick = () => {
    window.clearInterval(titleTimer)
    window.removeEventListener("resize", keepInView)
    video.controls = controls
    if (document.pictureInPictureElement !== video) video.playbackRate = rate
    if (style === null) video.removeAttribute("style")
    else video.setAttribute("style", style)
    if (parent?.isConnected) {
      const anchor = next?.parentNode === parent ? next : null
      moveVideo(parent, anchor)
    } else video.pause()
    popup.remove()
  }
  const place = (left: number, top: number) => {
    popup.style.right = "auto"
    popup.style.bottom = "auto"
    popup.style.left = `${Math.max(0, Math.min(innerWidth - popup.offsetWidth, left))}px`
    popup.style.top = `${Math.max(0, Math.min(innerHeight - popup.offsetHeight, top))}px`
  }
  const keepInView = () => {
    const rect = popup.getBoundingClientRect()
    place(rect.left, rect.top)
  }
  const resizeTo = (width: number, left: number, top: number) => {
    const maxWidth = innerWidth
    popup.style.width = `${Math.min(maxWidth, Math.max(240, width))}px`
    place(left, top)
  }
  let drag: { x: number; y: number } | undefined
  bar.onpointerdown = (event) => {
    if (event.button !== 0 || (event.target as Element).closest("button, select")) return
    const rect = popup.getBoundingClientRect()
    drag = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    bar.setPointerCapture(event.pointerId)
  }
  bar.onpointermove = (event) => {
    if (!drag) return
    place(event.clientX - drag.x, event.clientY - drag.y)
  }
  bar.onlostpointercapture = () => { drag = undefined }
  bar.append(title, speed, close)
  shadow.append(bar)
  document.documentElement.append(popup)
  popup.showPopover()
  video.controls = true
  video.style.cssText = "display:block;width:100%;height:auto;max-height:65vh;background:black;object-fit:contain"
  const surface = document.createElement("div")
  popup.style.maxWidth = "100vw"
  const footer = document.createElement("footer")
  const resize = document.createElement("button")
  resize.type = "button"
  resize.className = "resize-handle"
  resize.textContent = "↔"
  resize.title = "拖动调整宽度，也可使用左右方向键"
  resize.setAttribute("aria-label", resize.title)
  let sizing: { pointer: number; x: number; rect: DOMRect } | undefined
  resize.onpointerdown = (event) => {
    if (event.button !== 0) return
    sizing = { pointer: event.pointerId, x: event.clientX, rect: popup.getBoundingClientRect() }
    resize.setPointerCapture(event.pointerId)
  }
  resize.onpointermove = (event) => {
    if (sizing?.pointer !== event.pointerId) return
    const { x, rect } = sizing
    resizeTo(rect.width + event.clientX - x, rect.left, rect.top)
  }
  resize.onlostpointercapture = () => { sizing = undefined }
  resize.onkeydown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const rect = popup.getBoundingClientRect()
    resizeTo(rect.width + (event.key === "ArrowRight" ? 24 : -24), rect.left, rect.top)
  }
  footer.append(resize)
  shadow.append(surface, footer)
  window.addEventListener("resize", keepInView)
  moveVideo(surface, null)
  void video.play().catch(() => {})
  return undefined
}
