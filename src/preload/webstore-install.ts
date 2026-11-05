/** Installs a narrow click handler in the isolated guest preload. No installation API is exposed to pages. */
export function bindWebStoreInstall(request: () => void) {
  const id = () => {
    if (location.protocol !== "https:" || location.hostname !== "chromewebstore.google.com") return null
    return location.pathname.match(/^\/detail\/(?:[^/]+\/)?([a-p]{32})\/?$/)?.[1]
  }
  const label = /^(?:Add to Chrome|添加至\s*Chrome|添加到\s*Chrome|加到\s*Chrome)$/i
  const update = () => {
    if (!id()) { document.querySelectorAll('[data-vessel-store-install]').forEach(el => el.remove()); return }
    for (const button of document.querySelectorAll<HTMLElement>('button, [role="button"]')) {
      if (!label.test(button.textContent?.trim() || "")) continue
      button.setAttribute("data-vessel-store-original", "")
      button.hidden = true
      button.style.setProperty("display", "none", "important")
      if (button.parentElement?.querySelector('[data-vessel-store-install]')) continue
      const install = document.createElement("button")
      install.type = "button"
      install.textContent = "添加至 Vessel"
      install.setAttribute("data-vessel-store-install", "")
      install.style.cssText = "border:0;border-radius:24px;background:#16a34a;color:white;padding:12px 22px;font:600 14px system-ui;cursor:pointer"
      button.after(install)
    }
  }
  document.addEventListener("click", event => {
    if (!event.isTrusted || !id()) return
    const button = (event.target as Element | null)?.closest<HTMLElement>('button, [role="button"]')
    if (!button || (!button.hasAttribute("data-vessel-store-install") && !label.test(button.textContent?.trim() || ""))) return
    event.preventDefault(); event.stopImmediatePropagation(); request()
  }, true)
  const start = () => {
    update()
    let queued = false
    new MutationObserver(() => {
      if (queued) return
      queued = true
      queueMicrotask(() => { queued = false; update() })
    }).observe(document.documentElement, { childList: true, subtree: true })
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true })
  else start()
}
