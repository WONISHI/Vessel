import { useEffect, useRef } from "react"
import { guestFindScript, type GuestFindResult } from "@/pages/browser/guest-find"
import { withGuest } from "@/pages/browser/guest-lifecycle"
import type { BrowserState } from "./use-browser-state"

type FindState = Pick<BrowserState, "views" | "tab" | "findOpen" | "findText" | "matchCase" | "setFindResult">

export function useBrowserFind({ views, tab, findOpen, findText, matchCase, setFindResult }: FindState, visible: boolean) {
  const search = useRef<(forward: boolean) => void>(() => {})
  useEffect(() => {
    const view = views.current.get(tab.id)
    let disposed = false
    let revision = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = (next = false, forward = true) => {
      clearTimeout(timer)
      const request = ++revision
      const text = visible && findOpen ? findText : ""
      const result = withGuest(view, (guest) => guest.executeJavaScript(guestFindScript(text, { next, forward, matchCase })))
      void Promise.resolve(result).then((value: GuestFindResult | undefined) => {
        if (disposed || request !== revision || !value) return
        setFindResult({ ...value, tabId: tab.id, text })
      }).catch((error) => console.warn("网页查找失败", error))
    }
    search.current = (forward) => run(true, forward)
    const schedule = () => {
      clearTimeout(timer)
      setFindResult({ activeMatchOrdinal: 0, matches: 0, tabId: tab.id, text: findText })
      if (visible && findOpen && findText) timer = setTimeout(() => run(), 180)
      else run()
    }
    view?.addEventListener("dom-ready", schedule)
    schedule()
    return () => {
      disposed = true
      clearTimeout(timer)
      search.current = () => {}
      view?.removeEventListener("dom-ready", schedule)
    }
  }, [visible, tab.id, findOpen, findText, matchCase])

  useEffect(() => {
    const view = views.current.get(tab.id)
    return () => {
      const result = withGuest(view, (guest) => guest.executeJavaScript(guestFindScript("")))
      void Promise.resolve(result).catch(() => {})
    }
  }, [visible, tab.id])

  return (forward = true) => search.current(forward)
}
