import { pageTransitionSurfaces } from "./page-transition-surfaces"
import { flushSync } from "react-dom"
import type { RouterController } from "@vessel/react-router"
import "./page-transition.css"

type ActivePageTransition = { transition?: ViewTransition; abort: AbortController; release: () => void }
let active: ActivePageTransition | undefined
let surfaceToken = 0
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
  active?.transition?.skipTransition()
  active?.release()
  active = undefined
  delete document.documentElement.dataset.pageTransition
  const animate = readyPages.has(destination) && Boolean(document.startViewTransition) && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  const surfaces = pageTransitionSurfaces()
  if (!animate && !surfaces.length) return Promise.resolve(change()).then(() => {})
  const abort = new AbortController()
  const token = ++surfaceToken
  let released = false
  const release = () => {
    if (released) return
    released = true
    for (const surface of surfaces) void surface.finish(token).catch(console.error)
  }
  const entry: ActivePageTransition = { abort, release }
  active = entry
  if (animate) document.documentElement.dataset.pageTransition = "active"
  const finish = () => {
    release()
    if (active === entry) { active = undefined; delete document.documentElement.dataset.pageTransition }
  }
  const start = () => {
    if (abort.signal.aborted) { release(); return Promise.resolve() }
    // Even an unanimated first visit must retain the native frame for the return.
    if (!animate) {
      let result: unknown
      try { flushSync(() => { result = change() }) }
      catch (error) { finish(); throw error }
      return Promise.resolve(result).then(() => {}).finally(finish)
    }
    let transition: ViewTransition
    try {
      transition = document.startViewTransition(async () => {
        let result: unknown
        flushSync(() => { result = change() })
        await result
        // Snapshot updates suppress rendering: never wait for animation frames here.
        if (loading()) transition.skipTransition()
      })
    } catch (error) {
      finish()
      throw error
    }
    entry.transition = transition
    void transition.ready.catch(() => {})
    void transition.finished.catch(() => {}).finally(finish)
    return transition.updateCallbackDone.catch(error => { if (!abort.signal.aborted) throw error })
  }
  // Preparing native frames must finish before the outgoing snapshot is taken.
  return surfaces.length ? Promise.all(surfaces.map(surface => surface.prepare(token).catch(console.error))).then(start) : start()
}

export const pageTransitionKey = (path: string) => path.split(/[?#]/, 1)[0].split("/")[1] || "welcome"
const pages = new Set(["welcome", "editor", "browser", "resources", "office", "image", "attachments", "git", "api-client", "settings", "debug"])

/** Cover activity menus, rails, useNavigate and router.push with the same transition. */
export function installPageTransitions(router: RouterController) {
  const native = router.nativeRouter
  const original = native.navigate
  const originalSubscribe = native.subscribe
  const history = [native.state.location]
  let cursor = 0
  let committingTransition = false
  // POP and redirects can drop navigate options. Keep router commits synchronous
  // throughout an animated navigation so the snapshot contains the final page.
  if (originalSubscribe) native.subscribe = (listener) => originalSubscribe.call(native, (state, update) => listener(state, { ...update, flushSync: committingTransition || update.flushSync }))
  const unsubscribe = native.subscribe?.((state) => {
    if (state.location.key === history[cursor]?.key) return
    if (state.historyAction === "POP") {
      const index = history.findIndex((entry) => entry.key === state.location.key)
      if (index >= 0) cursor = index
      else { history.splice(0, history.length, state.location); cursor = 0 }
    } else if (state.historyAction === "REPLACE") history[cursor] = state.location
    else { history.splice(cursor + 1); history.push(state.location); cursor++ }
  })
  let pending: { target: unknown; options: Record<string, unknown> | undefined; result: Promise<void> } | undefined
  native.navigate = ((...args: unknown[]) => {
    const to = args[0]
    const target = typeof to === "number" ? history[cursor + to]?.pathname : typeof to === "string" ? to : to && typeof to === "object" && "pathname" in to ? String(to.pathname) : undefined
    const from = pageTransitionKey(native.state.location.pathname)
    const next = target?.startsWith("/") ? pageTransitionKey(target) : undefined
    const options = args[1] as Record<string, unknown> | undefined
    // Some rails notify their parent and then navigate themselves. Coalesce the
    // identical in-flight request rather than cancelling our own transition.
    if (pending && pending.target === to &&
      Object.keys({ ...pending.options, ...options }).every(key => pending!.options?.[key] === options?.[key])) return pending.result
    // Diagnostics has independent child pages. Returning between them must not
    // be treated like switching document tabs within the workspace.
    const debugPageChanged = !committingTransition && from === "debug" && next === "debug" && target?.split(/[?#]/, 1)[0] !== native.state.location.pathname
    const animate = next && (next !== from || debugPageChanged) && pages.has(next) && pages.has(from)
    const navigate = () => {
      if (animate && typeof to === "number") {
        // POP navigation can commit after navigate(delta) returns. Keep the
        // snapshot update open until the actual destination has committed.
        return new Promise<void>((resolve, reject) => {
          const previousKey = native.state.location.key
          committingTransition = true
          const stop = native.subscribe((state) => {
            if (state.location.key === previousKey || state.navigation.state !== "idle") return
            committingTransition = false
            stop()
            resolve()
          })
          Promise.resolve((original as (delta: number) => Promise<void>).call(native, to)).catch((error) => { committingTransition = false; stop(); reject(error) })
        })
      }
      if (animate) {
        committingTransition = true
        return Promise.resolve().then(() => (original as (...values: unknown[]) => Promise<void>).call(native, to, { ...options, flushSync: true }))
          .finally(() => { committingTransition = false })
      }
      return (original as (...values: unknown[]) => Promise<void>).apply(native, args)
    }
    const result = animate ? transitionPage(navigate, next) : navigate()
    const entry = { target: to, options, result }
    pending = entry
    void result.then(() => { if (pending === entry) pending = undefined }, () => { if (pending === entry) pending = undefined })
    return result
  }) as typeof native.navigate
  return () => { unsubscribe?.(); native.navigate = original; if (originalSubscribe) native.subscribe = originalSubscribe }
}
