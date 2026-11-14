import { BrowserContextMenu } from "./browser-page/browser-context-menu"
import { NavigationNotice } from "@/pages/browser/components/browser-page/navigation-notice"
import browserLoading from "@/assets/vessel-browser-loading/loading.svg"
import ActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { ResizableSplit } from "@/components/ui/resizable-split"
import { StatusBar } from "@/components/ui/status-bar"
import { BookmarkBar } from "@/pages/browser/components/bookmark-bar"
import { Guest } from "@/pages/browser/components/guest"
import { BrowserProxy } from "@/pages/browser/components/proxy"
import { DeviceToolbar } from "@/pages/browser/components/tools"
import { ZoomIn } from "lucide-react"
import { useBrowserPage } from "@/pages/browser/components/browser-page/hooks/use-browser-page"
import { BrowserTabs } from "@/pages/browser/components/browser-page/browser-tabs"
import { BrowserToolbar } from "@/pages/browser/components/browser-page/browser-toolbar"
import { BrowserDevtoolsPane } from "@/pages/browser/components/browser-page/browser-devtools-pane"
import { BrowserFindBar } from "@/pages/browser/components/browser-page/browser-find-bar"
import { BrowserHome } from "@/pages/browser/components/browser-page/browser-home"
import { BrowserStatusLeft } from "@/pages/browser/components/browser-page/browser-status-left"

/** Renders the browser page component. */
export function BrowserPage({ visible = true }: { visible?: boolean }) {
  const b = useBrowserPage(visible)
  const { router, deviceViewport, setDeviceViewport, toolbarCollapsed, deviceMode, setDeviceMode, tabs, findOpen, consoleWidth, setConsoleWidth, consoleHeight, setConsoleHeight, devtoolsOpen, dock, activatedTabs, bookmarks, removeBookmark, resetBookmarks, views, registerView, tab, update, navigate, zoom } = b

  return (
    <Layout
      aside={
        <ActivityBar
          activity="browser"
          onActivityChange={(item) => {
            if (item !== "browser") void router.push(item === "tools" ? "/devtools" : item === "files" ? "/editor" : `/${item}`)
          }}
        />
      }
    >
      <main className="vessel-browser flex min-w-0 flex-1 flex-col overflow-hidden font-sans">
        <BrowserTabs b={b} />
        <div className="relative shrink-0">
          <div hidden={toolbarCollapsed}>
            <BrowserToolbar b={b} visible={visible} />
            <BookmarkBar
              items={bookmarks}
              onNavigate={navigate}
              onRemove={removeBookmark}
              onReset={resetBookmarks}
            />
          </div>
        </div>
        {deviceMode && (
          <DeviceToolbar
            onViewport={setDeviceViewport}
            guest={() => views.current.get(tab.id)}
            tabId={tab.id}
            onClose={() => setDeviceMode(false)}
          />
        )}
        <div className={`browser-content dock-${dock}`}>
          <ResizableSplit
            side={dock === "detached" ? "detached" : dock === "left" ? "left" : dock === "right" ? "right" : "bottom"}
            size={dock === "bottom" ? consoleHeight : consoleWidth}
            min={dock === "bottom" ? 180 : 280}
            max={dock === "bottom" ? window.innerHeight * 0.7 : window.innerWidth * 0.7}
            label={dock === "bottom" ? "调整控制台高度" : "调整网页控制台宽度"}
            onResize={(value) => {
              if (dock === "bottom") {
                setConsoleHeight(value)
                localStorage.setItem("browser-console-height", String(value))
              } else {
                setConsoleWidth(value)
                localStorage.setItem("browser-console-width", String(value))
              }
            }}
            pane={
              devtoolsOpen && tab.url ? (
                <BrowserDevtoolsPane b={b} />
              ) : undefined
            }
          >
            <div className="relative h-full min-h-0 min-w-0 flex-1 bg-white">
              <BrowserContextMenu key={tab.id} b={b} visible={visible} />
              <NavigationNotice />
              {tab.devError && <div role="alert" className="absolute inset-x-4 top-4 z-40 max-h-[50%] overflow-auto rounded-lg border border-red-300 bg-background p-4 text-foreground shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm text-red-600">本地开发页面出现错误</strong>
                  <button type="button" aria-label="关闭开发错误提示" onClick={() => b.update(tab.id, { devError: undefined })}>×</button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">开发服务连接断开或页面脚本加载失败。请检查开发服务及代码，修复后刷新页面。</p>
                <details className="mt-2" open>
                  <summary className="cursor-pointer text-xs">错误详情</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{tab.devError}</pre>
                </details>
                <button type="button" className="mt-3 rounded border px-3 py-1 text-xs" onClick={() => b.reloadTab(tab.id)}>重新加载页面</button>
              </div>}

              {findOpen && (
                <BrowserFindBar b={b} />
              )}

              {tab.loading && !tab.ready && (
                <div
                  className="browser-page-loading"
                  role="status"
                  aria-label="正在加载页面"
                >
                  <div className="browser-loading-bar" />
                  <div className="browser-loading-card">
                    <img
                      src={browserLoading}
                      alt=""
                    />
                    <div>
                      正在加载页面
                      <span className="browser-loading-dots">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    </div>
                    <small data-title={tab.url}>{tab.url}</small>
                  </div>
                </div>
              )}
              {tab.loading && tab.ready && (
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 z-[220] h-1"
                  role="status"
                  aria-label="正在加载页面"
                >
                  <div className="browser-loading-bar" />
                </div>
              )}
              <div className={deviceMode && tab.url ? "device-preview-surface absolute inset-0 overflow-auto p-7" : "absolute inset-0"}>
                <div style={deviceMode && tab.url ? { width: deviceViewport.width + 2, height: deviceViewport.height + 2, margin: "0 auto" } : { width: "100%", height: "100%" }}>
                  <div
                    aria-label={deviceMode ? "设备预览边框" : undefined}
                    style={
                      deviceMode && tab.url
                        ? { width: deviceViewport.width, height: deviceViewport.height, boxSizing: "content-box", border: "1px solid #d6d3d1", borderRadius: 4, boxShadow: "0 8px 32px #0000001a, 0 2px 8px #0000000a", background: "white", overflow: "hidden" }
                        : { width: "100%", height: "100%" }
                    }
                  >
                    <div
                      aria-label={deviceMode ? "设备预览内容" : undefined}
                      style={deviceMode && tab.url ? { width: deviceViewport.width, height: deviceViewport.height, transform: `scale(${deviceViewport.scale})`, transformOrigin: "top left" } : { width: "100%", height: "100%" }}
                    >
                      {tabs
                        .filter((item) => item.url && activatedTabs.has(item.id))
                        .map((item) => (
                          <Guest
                            key={item.id}
                            tab={item}
                            visible={visible && item.id === tab.id}
                            register={registerView}
                            update={update}
                          />
                        ))}
                    </div>
                  </div>
                </div>
              </div>
              {!tab.url && (
                <BrowserHome b={b} />
              )}
              {tab.error && (
                <div
                  role="alert"
                  className="absolute inset-x-4 top-4 break-words rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {tab.error}
                  <button
                    className="ml-4 underline"
                    onClick={() => navigate(tab.url)}
                  >
                    重试
                  </button>
                </div>
              )}
            </div>
          </ResizableSplit>
        </div>
        <StatusBar
          className="browser-shared-status"
          left={
            <BrowserStatusLeft b={b} />
          }
          right={<BrowserProxy showLabel />}
          after={
            <button
              data-title="恢复 100% 缩放"
              aria-label="恢复页面缩放"
              className="ml-2 flex shrink-0 items-center gap-1 border-l border-stone-300 px-2 py-1 hover:bg-stone-200"
              onClick={() => zoom(1 - tab.zoom)}
            >
              <ZoomIn size={13} />
              {Math.round(tab.zoom * 100)}%
            </button>
          }
        />
      </main>
    </Layout>
  )
}
