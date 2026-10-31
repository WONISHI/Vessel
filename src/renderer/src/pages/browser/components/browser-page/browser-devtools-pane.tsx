import { X } from "lucide-react"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

/** 网页控制台面板 */
export function BrowserDevtoolsPane({ b }: { b: BrowserPageModel }) {
  const { setDevtoolsOpen, dock, setDock, consoleFont, setConsoleFont, consoleSize, setConsoleSize, devtoolsHost } = b

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
                    className="min-h-0 flex-1"
                  />
                </section>
  )
}
