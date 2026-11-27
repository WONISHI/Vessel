import { toast } from "sonner"
import { BrowserSiteColorContext } from "@/pages/browser/components/browser-site-color-context"
import { PasswordVault } from "@/pages/browser/components/password-vault"
import { FloatingVideo } from "./floating-video"
import { SearchEnginePicker } from "./search-engine-picker"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { effectiveSiteColor } from "@/pages/browser/favicon-color"
import { addTransit } from "@/components/transit/state"
import { Button } from "@/components/ui/button"
import { BrowserExtensions } from "@/pages/browser/components/extensions"
import { HistoryInput } from "@/pages/browser/components/history-input"
import { newTab } from "@/pages/browser/components/index-shared"
import { BrowserMore } from "@/pages/browser/components/tools"
import { elementPickerScript } from "@/pages/browser/element-picker"
import { stopGuestLoading, withGuest } from "@/pages/browser/guest-lifecycle"
import { browserURL } from "@/pages/browser/url"
import { ArrowLeft, ArrowRight, Bug, Home, Info, LoaderCircle, LockKeyhole, Pin, RotateCw, Search, Sparkles, SquareDashedMousePointer, X } from "lucide-react"
import "@vscode/codicons/dist/codicon.css"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

/** 地址栏与导航工具条 */
export function BrowserToolbar({ b, visible = true }: { b: BrowserPageModel; visible?: boolean }) {
  const { reloadTab, deviceMode, setDeviceMode, setTabs, setFindOpen, devtoolsOpen, setDevtoolsOpen, setActive, input, setInput, bookmarks, views, tab, getActivePageData, update, navigate, zoom, bookmark } = b

  const address = useRef<HTMLFormElement>(null)
  const [focused, setFocused] = useState(false)
  const [engineOpen, setEngineOpen] = useState(false)
  const [decodedAddress, setDecodedAddress] = useState<string | null>(null)
  useEffect(() => { setDecodedAddress(null) }, [tab.id, tab.url, tab.loading])
  const fullAddress = input ?? tab.url
  const editing = focused || engineOpen

  return (
            <BrowserSiteColorContext.Provider value={effectiveSiteColor(tab.faviconColor)}><div className="browser-toolbar" style={{ "--browser-site-color": effectiveSiteColor(tab.faviconColor) } as CSSProperties}>
              <Button
                variant="ghost"
                size="icon"
                data-title="后退"
                disabled={!tab.back}
                onClick={() => withGuest(views.current.get(tab.id), (guest) => guest.goBack())} aria-label="后退"
              >
                <ArrowLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-title="前进"
                disabled={!tab.forward}
                onClick={() => withGuest(views.current.get(tab.id), (guest) => guest.goForward())} aria-label="前进"
              >
                <ArrowRight />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-title={tab.loading ? "停止" : "刷新（F5）"}
                aria-label={tab.loading ? "停止加载" : "刷新页面"}
                disabled={!tab.url}
                onClick={() => {
                  const view = views.current.get(tab.id)
                  if (tab.loading) void stopGuestLoading(view).then(stopped => {
                    if (stopped) update(tab.id, { loading: false })
                  }).catch(error => toast.error("停止加载失败", { description: String(error) }))
                  else reloadTab(tab.id)
                }}
              >
                {tab.loading ? <X /> : <RotateCw />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-title="首页"
                onClick={() => {
                  if (!tab.url) return
                  const view = views.current.get(tab.id)
                  if (view) void view.loadURL("about:blank").catch(error => toast.error("返回首页失败", { description: String(error) }))
                  else update(tab.id, { ...newTab(), id: tab.id })
                  setInput(null)
                }} aria-label="首页"
              >
                <Home />
              </Button>
              <form
                ref={address}
                className="browser-address"
                onBlur={(event) => {
                  const target = event.relatedTarget
                  if (!(target instanceof Element && target.closest("[data-search-engine-trigger]"))) setFocused(false)
                }}
                onSubmit={(event) => {
                  event.preventDefault()
                  navigate(input ?? tab.url)
                }}
              >
                {editing ? (
                  <SearchEnginePicker open={engineOpen} onOpenChange={setEngineOpen}
                    onSelect={() => address.current?.querySelector("input")?.focus()} />
                ) : tab.loading ? <LoaderCircle size={14} className="shrink-0 animate-spin" aria-label="正在加载" /> : /^https:\/\//i.test(fullAddress) ? <LockKeyhole size={14} />
                  : /^http:\/\//i.test(fullAddress) ? <Info size={14} /> : <Search size={14} />}
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
                  aria-label="搜索或输入网址"
                  placeholder="搜索或输入网址"
                  value={editing ? (decodedAddress ?? fullAddress) : fullAddress.replace(/^https?:\/\//i, "")}
                  suppressSuggestions={engineOpen}
                  onDoubleClick={(event) => {
                    event.preventDefault()
                    event.currentTarget.select()
                  }}
                  onChange={(event) => { setDecodedAddress(null); setInput(event.target.value) }}
                  onFocus={(event) => {
                    setFocused(true)
                    const field = event.currentTarget
                    requestAnimationFrame(() => {
                      if (window.document.activeElement === field) field.select()
                    })
                  }}
                />
                <PasswordVault url={tab.url} guestId={() => withGuest(views.current.get(tab.id), (guest) => guest.getWebContentsId())} />
                <button
                  type="button"
                  data-browser-bookmark-action
                  data-title={focused ? (decodedAddress === null ? "解码地址" : "恢复原编码地址") : "收藏当前页面"}
                  aria-label={focused ? (decodedAddress === null ? "解码地址" : "恢复原编码地址") : bookmarks.some((item) => item.url === tab.url) ? "取消书签" : "添加书签"}
                  disabled={focused ? !fullAddress : !tab.url}
                  onMouseDown={(event) => { if (focused) event.preventDefault() }}
                  onClick={(event) => {
                    if (!focused) {
                      const star = event.currentTarget.querySelector("i")
                      if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
                        star?.getAnimations?.().forEach((animation) => animation.cancel())
                        star?.animate?.([
                          { transform: "scale(1)", offset: 0 },
                          { transform: "scale(1.25)", offset: .44 },
                          { transform: "scale(.94)", offset: .74 },
                          { transform: "scale(1)", offset: 1 }
                        ], { duration: 380, easing: "ease-out" })
                      }
                      bookmark()
                      return
                    }
                    if (decodedAddress !== null) { setDecodedAddress(null); return }
                    try { setDecodedAddress(decodeURIComponent(fullAddress)) }
                    catch { setDecodedAddress(fullAddress.replace(/(?:%[0-9a-f]{2})+/gi, (value) => { try { return decodeURIComponent(value) } catch { return value } })) }
                  }}
                >
                  {focused ? <Sparkles size={16} /> : <i
                    aria-hidden="true"
                    className={`codicon ${bookmarks.some((item) => item.url === tab.url) ? "codicon-star-full" : "codicon-star-empty"} !text-base`}
                  />}
                </button>
              </form>
              <FloatingVideo visible={visible} tabId={tab.id} url={tab.url} getGuest={() => views.current.get(tab.id)} />
              <Button
                variant="ghost"
                size="icon"
                data-title="查看元素信息（Esc 退出，再次点击关闭）"
                aria-label="查看元素信息"
                disabled={!tab.url}
                onClick={() => {
                  void withGuest(views.current.get(tab.id), (guest) => guest.executeJavaScript(elementPickerScript).catch((error) => window.alert(`无法查看元素：${String(error)}`)))
                }}
              >
                <SquareDashedMousePointer />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="加入中转站"
                data-title="加入中转站"
                disabled={!tab.url}
                onClick={() => {
                  try {
                    addTransit(tab.url, tab.title)
                  } catch (error) {
                    window.alert(String(error))
                  }
                }}
              >
                <Pin />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-title="当前网页控制台"
                aria-label="打开当前网页控制台"
                disabled={!tab.url}
                aria-pressed={devtoolsOpen}
                onClick={() => setDevtoolsOpen((open) => !open)}
              >
                <Bug />
              </Button>
              <BrowserExtensions
                visible={visible}
                onOpenDevtools={() => setDevtoolsOpen(true)}
                getActivePageData={getActivePageData}
                onOpenStore={(url) => {
                  const next = { ...newTab(), url, loading: true }
                  setTabs((previous) => [...previous, next])
                  setActive(next.id)
                }}
              />
              <BrowserMore
                siteColor={tab.faviconColor}
                incognito={b.incognito}
                hasIncognito={Boolean(b.privateWindow)}
                onEnterIncognito={b.enterIncognito}
                onCloseIncognito={b.closeIncognito}
                onSwitchUserWindow={b.switchUserWindow}
                bookmarksVisible={b.bookmarksVisible}
                onToggleBookmarks={() => b.setBookmarksVisible(value => !value)}
                visible={visible}
                zoomFactor={tab.zoom}
                zoom={zoom}
                onFind={() => setFindOpen(true)}
                onNavigate={navigate}
                guest={() => views.current.get(tab.id)}
                deviceMode={deviceMode}
                onDevice={() => {
                  setDeviceMode((value) => !value)
                }}
              />
            </div></BrowserSiteColorContext.Provider>
  )
}
