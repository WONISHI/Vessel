import { useProxyEnabled } from "@/pages/debug/proxy/use-proxy-enabled"
import "@/pages/debug/workbench.css"
import "@vscode/codicons/dist/codicon.css"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable-panels"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSidebar } from "@/components/ui/sidebar"
import { StatusBar } from "@/components/ui/status-bar"
import { Layers, Wrench } from "lucide-react"
import { getDevToolGroups } from "@/pages/debug/components/index-shared"
import { RouterView } from "@vessel/react-router/components"
import { useLocation, useNavigate } from "react-router-dom"

/** Renders the dev tools body component. */
export function DevToolsBody({ selectedTool, onSelectTool, children }: { selectedTool?: string; onSelectTool?: (id: string) => void; children?: ReactNode } = {}) {
  const groups = getDevToolGroups(useProxyEnabled())
  const { pathname } = useLocation(),
    navigate = useNavigate()
  const { open, openMobile, isMobile } = useSidebar()
  const expanded = isMobile ? openMobile : open
  const current = groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title }))).find((item) => (selectedTool ? selectedTool === item.id : pathname.endsWith("/" + item.id)))
  const selectTool = (id: string) => onSelectTool ? onSelectTool(id) : navigate(`/devtools/${id}`)
  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col">
    <ResizablePanelGroup
      orientation="horizontal"
      className="dev-tools min-h-0 flex-1 bg-white"
    >
      {expanded && (
        <>
          <ResizablePanel
            defaultSize="208px"
            minSize="176px"
            maxSize="260px"
          >
            <aside className="dev-workbench-nav flex h-full flex-col bg-white">
              <h1 className="dev-sidebar-title px-4 py-4 text-sm font-bold text-stone-800"><i aria-hidden="true" className="codicon codicon-developer-tools !text-base" />开发工具<span>{groups.reduce((total, group) => total + group.items.length, 0)}</span></h1>
              <ScrollArea className="min-h-0 flex-1 px-2">
                {groups.map((group) => (
                  <section
                    key={group.title}
                    className="dev-nav-group mb-3"
                  >
                    <h2 className="dev-nav-label px-2 py-2 text-[10px] font-bold tracking-wide text-stone-400">{group.title}</h2>
                    {group.items.map(({ id, title, icon: Icon }) => (
                      <Button
                        key={id}
                        variant="ghost"
                        onClick={() => selectTool(id)}
                        aria-current={current?.id === id ? "page" : undefined}
                        className="dev-nav-item w-full justify-start shadow-none hover:text-foreground"
                      >
                        <Icon className="size-4" />
                        {title}
                      </Button>
                    ))}
                  </section>
                ))}
              </ScrollArea>
            </aside>
          </ResizablePanel>
          <ResizableHandle aria-label="调整开发工具侧栏宽度" />
        </>
      )}
      <ResizablePanel minSize="350px">
        <main className="dev-workbench-main h-full min-w-0 overflow-hidden">
          {children ?? <RouterView />}
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
    <StatusBar
      left={current && (
        <button type="button" data-title={`${current.group} · ${current.title}`} onClick={() => selectTool(current.id)}>
          <current.icon />
          {current.title}
        </button>
      )}
    >
      <footer aria-label="开发工具信息" className="vessel-document-stats">
        <span><Wrench />{groups.reduce((total, group) => total + group.items.length, 0)} 个工具</span>
        {current && <span className="vessel-status-separated"><Layers />{current.group}</span>}
      </footer>
    </StatusBar>
    </div>
  )
}
