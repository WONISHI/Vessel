/** Original rounded-rectangle normal map for a shallow glass rim. */
export function glassDisplacement(width: number, height: number, radius = 16) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  const halfX = width / 2, halfY = height / 2
  const distance = (x: number, y: number) => {
    const dx = Math.abs(x - halfX) - halfX + radius
    const dy = Math.abs(y - halfY) - halfY + radius
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const d = distance(x + .5, y + .5)
    const weight = d <= 0 ? Math.exp(-Math.abs(d) / 4) * .8 : 0
    const nx = (distance(x + 1, y + .5) - distance(x, y + .5))
    const ny = (distance(x + .5, y + 1) - distance(x + .5, y))
    const offset = (y * width + x) * 4
    pixels[offset] = 128 + nx * weight * 127
    pixels[offset + 1] = 128
    pixels[offset + 2] = 128 + ny * weight * 127
    pixels[offset + 3] = 255
  }
  return pixels
}

/**
 * Inspired by rdev/liquid-glass-react's separate refraction/content layers.
 * The library owns the toolbar DOM and geometry, so only its decorative backdrop is filtered.
 */
export function installLiquidGlass(toolbar: HTMLElement) {
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("aria-hidden", "true")
  svg.style.cssText = "position:fixed;width:0;height:0;pointer-events:none"
  const defs = document.createElementNS(ns, "defs")
  const filter = document.createElementNS(ns, "filter")
  filter.id = `shot-${toolbar.id}-glass`
  filter.setAttribute("x", "-15%")
  filter.setAttribute("y", "-50%")
  filter.setAttribute("width", "130%")
  filter.setAttribute("height", "200%")
  filter.setAttribute("color-interpolation-filters", "sRGB")
  const map = document.createElementNS(ns, "feImage")
  map.setAttribute("width", "100%")
  map.setAttribute("height", "100%")
  map.setAttribute("preserveAspectRatio", "none")
  map.setAttribute("result", "rim")
  const bend = document.createElementNS(ns, "feDisplacementMap")
  bend.setAttribute("in", "SourceGraphic")
  bend.setAttribute("in2", "rim")
  bend.setAttribute("scale", "12")
  bend.setAttribute("xChannelSelector", "R")
  bend.setAttribute("yChannelSelector", "B")
  filter.append(map, bend)
  defs.append(filter)
  svg.append(defs)
  document.body.append(svg)
  toolbar.classList.add("shot-liquid-glass")
  let oldSize = ""
  const resize = () => {
    const bounds = toolbar.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const width = Math.max(1, Math.round(bounds.width)), height = Math.max(1, Math.round(bounds.height))
    const key = width + "x" + height
    if (key === oldSize) return
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) return
    const image = context.createImageData(width, height)
    image.data.set(glassDisplacement(width, height))
    context.putImageData(image, 0, 0)
    map.setAttribute("href", canvas.toDataURL("image/png"))
    oldSize = key
  }
  let frame = 0
  const move = (event: PointerEvent) => {
    cancelAnimationFrame(frame)
    const x = event.clientX, y = event.clientY
    frame = requestAnimationFrame(() => {
      const rect = toolbar.getBoundingClientRect()
      toolbar.style.setProperty("--glass-x", `${x - rect.left}px`)
      toolbar.style.setProperty("--glass-y", `${y - rect.top}px`)
    })
  }
  const leave = () => {
    cancelAnimationFrame(frame)
    toolbar.style.removeProperty("--glass-x")
    toolbar.style.removeProperty("--glass-y")
  }
  const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize)
  observer?.observe(toolbar)
  resize()
  toolbar.addEventListener("pointermove", move)
  toolbar.addEventListener("pointerleave", leave)
  return () => {
    observer?.disconnect()
    cancelAnimationFrame(frame)
    toolbar.removeEventListener("pointermove", move)
    toolbar.removeEventListener("pointerleave", leave)
    toolbar.classList.remove("shot-liquid-glass")
    leave()
    svg.remove()
  }
}
