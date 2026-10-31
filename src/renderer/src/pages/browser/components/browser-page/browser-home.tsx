import { HistoryInput } from "@/pages/browser/components/history-input"
import { newTab, shortcuts } from "@/pages/browser/components/index-shared"
import { browserURL } from "@/pages/browser/url"
import { Globe, Search } from "lucide-react"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

/** 空白标签页首页 */
export function BrowserHome({ b }: { b: BrowserPageModel }) {
  const { setTabs, setActive, setInput, searchInput, setSearchInput, navigate } = b

  return (
                <div className="browser-home">
                  <div className="browser-logo">
                    <Globe size={36} />
                  </div>
                  <h1>Vessel 浏览器</h1>
                  <p>快速搜索或访问常用网站</p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      navigate(searchInput)
                    }}
                  >
                    <Search size={20} />
                    <HistoryInput
                      onNavigate={(value, newWindow) => {
                        if (newWindow) {
                          const next = { ...newTab(), url: browserURL(value), loading: true }
                          setTabs((current) => [...current, next])
                          setActive(next.id)
                          setInput(null)
                        } else navigate(value)
                      }}
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="none"
                      aria-label="搜索"
                      placeholder="搜索或输入网址，按 Enter 访问"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                    />
                  </form>
                  <div className="browser-shortcuts">
                    {shortcuts.map((item) => (
                      <button
                        key={item.url}
                        onClick={() => navigate(item.url)}
                      >
                        <span>{item.title[0]}</span>
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
  )
}
