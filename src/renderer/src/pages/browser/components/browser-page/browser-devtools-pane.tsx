import { registerPageTransitionSurface } from "@/lib/page-transition-surfaces"
import { flushSync } from "react-dom"
import { withGuest } from "@/pages/browser/guest-lifecycle"
import { useEffect, useRef, useState } from "react"
import { BrowserDevtoolsControls } from "./browser-devtools-controls"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

/** 网页控制台面板 */
export function BrowserDevtoolsPane({ b }: { b: BrowserPageModel }) {
  const { dock, devtoolsHost } = b

  const [preview, setPreview] = useState<{ tabId: string; image?: string }>()
  const [transitionPreview, setTransitionPreview] = useState<{ tabId: string; image: string }>()
  const previewImage = useRef<HTMLImageElement>(null)
  const previewToken = useRef<number | undefined>(undefined)
  const tabId = b.tab.id
  const views = b.views
  useEffect(() => window.electronAPI.onBrowserDevtoolsPreview?.((value) => {
    if (withGuest(views.current.get(tabId), guest => guest.getWebContentsId()) === value.id) setPreview({ tabId, image: value.image })
  }), [tabId, views])
  useEffect(() => {
    if (dock === "detached" || !window.electronAPI.setBrowserDevtoolsTransition) return
    let alive = true
    const stop = registerPageTransitionSurface({
      prepare: async (token) => {
        previewToken.current = token
        const snapshot = await window.electronAPI.setBrowserDevtoolsTransition(token, true)
        if (!alive || previewToken.current !== token || !snapshot) return
        if (withGuest(views.current.get(tabId), guest => guest.getWebContentsId()) !== snapshot.id) return
        flushSync(() => setTransitionPreview({ tabId, image: snapshot.image }))
        await previewImage.current?.decode?.().catch(() => {})
      },
      finish: async (token) => {
        await window.electronAPI.setBrowserDevtoolsTransition(token, false)
        if (alive && previewToken.current === token) {
          previewToken.current = undefined
          setTransitionPreview(undefined)
        }
      }
    })
    return () => { alive = false; stop() }
  }, [dock, tabId, views])
  const image = transitionPreview?.tabId === tabId ? transitionPreview.image : preview?.tabId === tabId ? preview.image : undefined

  return (
                <section
                  className="browser-devtools"
                  style={{ height: dock === "detached" ? "auto" : "100%", width: "100%", minHeight: 0 }}
                  aria-label="当前网页控制台"
                >
                  <BrowserDevtoolsControls b={b} />
                  <div
                    ref={devtoolsHost}
                    className="relative min-h-0 flex-1 overflow-hidden"
                  >
                    {image && <img ref={previewImage} src={image} alt="被浮层遮挡的控制台画面" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-fill" />}
                  </div>
                </section>
  )
}
