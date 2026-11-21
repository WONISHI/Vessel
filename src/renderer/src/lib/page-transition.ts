import { flushSync } from "react-dom"
import type { RouterController } from "@vessel/react-router"
import "./page-transition.css"

let active: { transition: ViewTransition; abort: AbortController } | undefined
const readyPages = new Set<string>()
const cancelled = () => new DOMException("Superseded page transition", "AbortError")

function frame(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { cancelAnimationFrame(id); reject(cancelled()) }
    const id = requestAnimationFrame(() => { signal.removeEventListener("abort", abort); signal.aborted ? reject(cancelled()) : resolve() })
    signal.addEventListener("abort", abort, { once: true })
  })
}

function loading() {
  return [...document.querySelectorAll("[data-page-transition-loading]")].some(node => {
    for (let parent: Element | null = node; parent; parent = parent.parentElement) {
      if (parent.hasAttribute("hidden") || parent.getAttribute("aria-hidden") === "true" || getComputedStyle(parent).display === "none") return false
    }
    return true
  })
}

/** Observe readiness outside snapshot updates, where animation frames are available. */
export async function waitForPageContent(signal: AbortSignal) {
  await frame(signal)
  await frame(signal)
  if (!loading()) return
  await new Promise<void>((resolve, reject) => {
    const finish = () => { observer.disconnect(); signal.removeEventListener("abort", abort) }
    const abort = () => { finish(); reject(cancelled()) }
    const observer = new MutationObserver(() => { if (!loading()) { finish(); resolve() } })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-hidden", "style", "data-page-transition-loading"] })
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
    else if (!loading()) { finish(); resolve() }
  })
}

/** Record actual readiness, not merely a route visit or an import starting. */
export function rememberPageContent(key: string) {
  const abort = new AbortController()
  void waitForPageContent(abort.signal).then(() => readyPages.add(key)).catch(() => {})
  return () => abort.abort()
}

/** Only a previously loaded destination animates. First visits keep their normal loading UI. */
export function transitionPage(change: () => unknown, destination: string): Promise<void> {
  active?.abort.abort()
  active?.transition.skipTransition()
  active = undefined
  delete document.documentElement.dataset.pageTransition
  if (!readyPages.has(destination) || !document.startViewTransition || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return Promise.resolve(change()).then(() => {})
  }
  const abort = new AbortController()
  document.documentElement.dataset.pageTransition = "active"
  const transition = document.startViewTransition(async () => {
    let result: unknown
    flushSync(() => { result = change() })
    await result
    // View transitions suppress rendering while this callback runs. Waiting for
    // animation frames here can time out and skip the animation altogether.
    // A returning page that loads again should keep its regular loading UI.
    if (loading()) transition.skipTransition()
  })
  const entry = { transition, abort }
  active = entry
  void transition.ready.catch(() => {})
  void transition.finished.catch(() => {}).finally(() => {
    if (active === entry) { active = undefined; delete document.documentElement.dataset.pageTransition }
  })
  return transition.updateCallbackDone.catch(error => { if (!abort.signal.aborted) throw error })
}

export const pageTransitionKey = (path: string) => path.split(/[?#]/, 1)[0].split("/")[1] || "welcome"
const pages = new Set(["welcome", "editor", "browser", "resources", "office", "image", "attachments", "git", "api-client", "settings"])

/** Cover activity menus, rails, useNavigate and router.push with the same transition. */
export function installPageTransitions(router: RouterController) {
  const native = router.nativeRouter
  const original = native.navigate
  let pending: { target: unknown; options: Record<string, unknown> | undefined; result: Promise<void> } | undefined
  native.navigate = ((...args: unknown[]) => {
    const to = args[0]
    const target = typeof to === "string" ? to : to && typeof to === "object" && "pathname" in to ? String(to.pathname) : undefined
    const from = pageTransitionKey(native.state.location.pathname)
    const next = target?.startsWith("/") ? pageTransitionKey(target) : undefined
    const options = args[1] as Record<string, unknown> | undefined
    // Some rails notify their parent and then navigate themselves. Coalesce the
    // identical in-flight request rather than cancelling our own transition.
    if (pending && pending.target === to &&
      Object.keys({ ...pending.options, ...options }).every(key => pending!.options?.[key] === options?.[key])) return pending.result
    const animate = next && next !== from && pages.has(next) && pages.has(from)
    const navigate = () => (original as (...values: unknown[]) => Promise<void>).apply(native, animate ? [to, { ...options, flushSync: true }] : args)
    const result = animate ? transitionPage(navigate, next) : navigate()
    const entry = { target: to, options, result }
    pending = entry
    void result.then(() => { if (pending === entry) pending = undefined }, () => { if (pending === entry) pending = undefined })
    return result
  }) as typeof native.navigate
  return () => { native.navigate = original }
}
