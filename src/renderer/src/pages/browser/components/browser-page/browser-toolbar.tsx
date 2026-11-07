import { FloatingVideo } from "./floating-video"
import { SearchEnginePicker } from "./search-engine-picker"
import { useRef, useState } from "react"
import { addTransit } from "@/components/transit/state"
import { Button } from "@/components/ui/button"
import { BrowserExtensions } from "@/pages/browser/components/extensions"
import { HistoryInput } from "@/pages/browser/components/history-input"
import { newTab } from "@/pages/browser/components/index-shared"
import { BrowserMore } from "@/pages/browser/components/tools"
import { elementPickerScript } from "@/pages/browser/element-picker"
import { withGuest } from "@/pages/browser/guest-lifecycle"
import { browserURL } from "@/pages/browser/url"
import { ArrowLeft, ArrowRight, Bookmark, Bug, Home, Info, LoaderCircle, LockKeyhole, Pin, RotateCw, Search, SquareDashedMousePointer, X } from "lucide-react"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

/** 地址栏与导航工具条 */
export function BrowserToolbar({ b, visible = true }: { b: BrowserPageModel; visible?: boolean }) {
  const { deviceMode, setDeviceMode, setTabs, setFindOpen, devtoolsOpen, setDevtoolsOpen, setActive, input, setInput, bookmarks, views, tab, getActivePageData, update, navigate, zoom, bookmark } = b

  const address = useRef<HTMLFormElement>(null)
  const [focused, setFocused] = useState(false)
  const [engineOpen, setEngineOpen] = useState(false)
  const fullAddress = input ?? tab.url
  const editing = focused || engineOpen

  return (
            <div className="browser-toolbar">
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
                disabled={!tab.url}
                onClick={() => {
                  const view = views.current.get(tab.id)
                  if (tab.loading) withGuest(view, (guest) => guest.stop())
                  else withGuest(view, (guest) => guest.reload())
                }}
              >
                {tab.loading ? <X /> : <RotateCw />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-title="首页"
                onClick={() => {
                  update(tab.id, { ...newTab(), id: tab.id })
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
                  value={editing ? fullAddress : fullAddress.replace(/^https?:\/\//i, "")}
                  suppressSuggestions={engineOpen}
                  onChange={(event) => setInput(event.target.value)}
                  onFocus={(event) => {
                    setFocused(true)
                    const field = event.currentTarget
                    requestAnimationFrame(() => {
                      if (window.document.activeElement === field) field.select()
                    })
                  }}
                />
                <button
                  type="button"
                  data-title="收藏当前页面"
                  aria-label={bookmarks.some((item) => item.url === tab.url) ? "取消书签" : "添加书签"}
                  disabled={!tab.url}
                  onClick={bookmark}
                >
                  <Bookmark
                    size={16}
                    fill={bookmarks.some((item) => item.url === tab.url) ? "currentColor" : "none"}
                  />
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
            </div>
  )
}
