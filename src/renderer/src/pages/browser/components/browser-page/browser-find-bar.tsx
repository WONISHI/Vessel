import { ChevronDown, ChevronUp, Search, X } from "lucide-react"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

/** 页内查找浮层 */
export function BrowserFindBar({ b }: { b: BrowserPageModel }) {
  const { setFindOpen, matchCase, setMatchCase, findText, setFindText, findResult, findInput, findPosition, setFindPosition, findDrag, tab, searchPage } = b

  return (
                <form
                  className="browser-find browser-find-bottom"
                  style={findPosition ? { position: "fixed", left: findPosition.x, top: findPosition.y, right: "auto", bottom: "auto" } : undefined}
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).closest("input, button") || event.button !== 0) return
                    event.preventDefault()
                    event.currentTarget.setPointerCapture(event.pointerId)
                    const rect = event.currentTarget.getBoundingClientRect()
                    document.body.classList.add("vessel-find-dragging")
                    findDrag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
                  }}
                  onPointerMove={(event) => {
                    const start = findDrag.current
                    if (!start) return
                    const rect = event.currentTarget.getBoundingClientRect()
                    setFindPosition({ x: Math.max(0, Math.min(innerWidth - rect.width, start.left + event.clientX - start.x)), y: Math.max(0, Math.min(innerHeight - rect.height, start.top + event.clientY - start.y)) })
                  }}
                  onPointerUp={() => {
                    findDrag.current = null
                    document.body.classList.remove("vessel-find-dragging")
                  }}
                  onPointerCancel={() => {
                    findDrag.current = null
                    document.body.classList.remove("vessel-find-dragging")
                  }}
                  aria-label="网页查找"
                  onSubmit={(event) => {
                    event.preventDefault()
                    searchPage(true, true)
                  }}
                >
                  <Search
                    size={15}
                    className="text-stone-400"
                  />
                  <input
                    ref={findInput}
                    aria-label="在网页中查找"
                    placeholder="在网页中查找"
                    spellCheck={false}
                    value={findText}
                    onChange={(event) => setFindText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setFindOpen(false)
                      if (event.key === "Enter" && event.shiftKey) {
                        event.preventDefault()
                        searchPage(false, true)
                      }
                    }}
                  />
                  <span className="browser-find-count">{findResult.tabId === tab.id && findResult.text === findText ? `${findResult.activeMatchOrdinal}/${findResult.matches}` : "0/0"}</span>
                  <button
                    type="button"
                    aria-label="上一个匹配"
                    disabled={!findText || !findResult.matches}
                    onClick={() => searchPage(false, true)}
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="submit"
                    aria-label="下一个匹配"
                    disabled={!findText || !findResult.matches}
                  >
                    <ChevronDown size={15} />
                  </button>
                  <span className="browser-find-divider" />
                  <button
                    type="button"
                    aria-label="区分大小写"
                    aria-pressed={matchCase}
                    onClick={() => setMatchCase((value) => !value)}
                  >
                    Aa
                  </button>
                  <button
                    type="button"
                    className="browser-find-close"
                    aria-label="关闭查找"
                    onClick={() => setFindOpen(false)}
                  >
                    <X size={15} />
                  </button>
                </form>
  )
}
