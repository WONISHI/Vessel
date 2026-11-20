import { withGuest } from "@/pages/browser/guest-lifecycle"
import { useEffect, useState } from "react"
import { X } from "lucide-react"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

/** 网页控制台面板 */
export function BrowserDevtoolsPane({ b }: { b: BrowserPageModel }) {
  const { setDevtoolsOpen, dock, setDock, consoleFont, setConsoleFont, consoleSize, setConsoleSize, devtoolsHost } = b

  const [preview, setPreview] = useState<{ tabId: string; image?: string }>()
  const tabId = b.tab.id
  const views = b.views
  useEffect(() => window.electronAPI.onBrowserDevtoolsPreview?.((value) => {
    if (withGuest(views.current.get(tabId), guest => guest.getWebContentsId()) === value.id) setPreview({ tabId, image: value.image })
  }), [tabId, views])
  const image = preview?.tabId === tabId ? preview.image : undefined

  return (
                <section
                  className="browser-devtools"
                  style={{ height: dock === "detached" ? "auto" : "100%", width: "100%", minHeight: 0 }}
                  aria-label="当前网页控制台"
                >
                  <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-2 py-1 text-xs text-stone-500">
                    <span className="mr-auto">网页控制台</span>
                    <select
                      aria-label="控制台停靠位置"
                      value={dock}
                      onChange={(event) => setDock(event.target.value)}
                    >
                      <option value="bottom">底部停靠</option>
                      <option value="left">左侧停靠</option>
                      <option value="right">右侧停靠</option>
                      <option value="detached">独立窗口</option>
                    </select>
                    <select
                      aria-label="控制台字体"
                      value={consoleFont}
                      onChange={(event) => setConsoleFont(event.target.value)}
                    >
                      {["Plus Jakarta Sans", "Menlo", "Consolas", "Courier New", "monospace", "system-ui"].map((font) => (
                        <option key={font}>{font}</option>
                      ))}
                    </select>
                    <select
                      aria-label="控制台字号（整体缩放）"
                      data-title="字号（整体缩放）"
                      value={consoleSize}
                      onChange={(event) => setConsoleSize(Number(event.target.value))}
                    >
                      {[11, 12, 13, 14, 16, 18, 20].map((size) => (
                        <option
                          key={size}
                          value={size}
                        >
                          {size}px
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label="关闭网页控制台"
                      onClick={() => setDevtoolsOpen(false)}
                    >
                      <X size={14} />
                    </button>
                  </header>
                  <div
                    ref={devtoolsHost}
                    className="relative min-h-0 flex-1 overflow-hidden"
                  >
                    {image && <img src={image} alt="被浮层遮挡的控制台画面" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-fill" />}
                  </div>
                </section>
  )
}
