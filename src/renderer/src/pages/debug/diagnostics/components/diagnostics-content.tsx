import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSidebar } from "@/components/ui/sidebar"
import { useDevToolsRouteTree } from "@/pages/debug/components/hooks/useDevToolsRouteTree"
import { useRouter } from "@vessel/react-router"
import { RouterView } from "@vessel/react-router/components"
import { Database, Terminal } from "lucide-react"

/** Renders the diagnostics content component. */
export function DiagnosticsContent() {
  const tree = useDevToolsRouteTree(),
    router = useRouter()
  const { open, openMobile, isMobile } = useSidebar()
  return (
    <div className="flex h-full min-w-0 flex-1 bg-background">
      {(isMobile ? openMobile : open) && (
        <aside className="flex h-full min-h-0 w-[232px] shrink-0 flex-col border-r bg-muted/20">
          <h1 className="px-4 py-4 text-sm font-semibold">调试页面</h1>
          <ScrollArea className="min-h-0 flex-1 px-2">
            {tree?.groups.map((group) => (
              <section
                key={group.name}
                className="mb-4"
              >
                <h2 className="px-3 py-2 text-xs text-muted-foreground">{String(group.meta?.title ?? "")}</h2>
                {group.children?.map((page) => {
                  const Icon = page.meta?.icon === "Database" ? Database : Terminal
                  return (
                    <Button
                      key={page.name}
                      variant="ghost"
                      className={`mb-1 w-full justify-start ${tree.currentPage?.name === page.name ? "bg-emerald-50 text-green-700" : ""}`}
                      aria-current={tree.currentPage?.name === page.name ? "page" : undefined}
                      onClick={() => {
                        void router.push({ name: page.name })
                      }}
                    >
                      <Icon className="size-4" />
                      {String(page.meta?.title ?? "")}
                    </Button>
                  )
                })}
              </section>
            ))}
          </ScrollArea>
        </aside>
      )}
      <main className="min-h-0 min-w-0 flex-1 overflow-auto">
        <RouterView />
      </main>
    </div>
  )
}
