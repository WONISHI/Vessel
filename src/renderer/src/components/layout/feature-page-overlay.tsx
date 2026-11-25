import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { lazyWithRetry } from "@/lib/lazy-retry"
import { Suspense, useEffect } from "react"
import { rememberPageContent } from "@/lib/page-transition"
import "@/pages/debug/tools.css"

const Todos = lazyWithRetry(() => import("@/pages/todos"))
const Tools = lazyWithRetry(() => import("@/pages/debug/components/dev-tools-index").then(module => ({ default: module.DevToolsIndex })))
const tools = {
  json: lazyWithRetry(() => import("@/pages/debug/json").then(module => ({ default: module.JsonTool }))),
  color: lazyWithRetry(() => import("@/pages/debug/color").then(module => ({ default: module.ColorTool }))),
  "case-convert": lazyWithRetry(() => import("@/pages/debug/case-convert").then(module => ({ default: module.CaseConvertTool }))),
  base64: lazyWithRetry(() => import("@/pages/debug/base64").then(module => ({ default: module.Base64Tool }))),
  url: lazyWithRetry(() => import("@/pages/debug/url").then(module => ({ default: module.URLTool }))),
  translate: lazyWithRetry(() => import("@/pages/debug/translate")),
  proxy: lazyWithRetry(() => import("@/pages/debug/proxy"))
}

/** Full-page utilities overlay the current route; closing unmounts only the utility. */
export function FeaturePageOverlay({ feature, tool, onToolChange, onClose }: { feature: "todos" | "devtools" | null; tool: string; onToolChange: (id: string) => void; onClose: () => void }) {
  const Tool = tools[tool as keyof typeof tools] ?? tools.json
  useEffect(() => {
    if (feature) return rememberPageContent(feature === "todos" ? "feature:todos" : `feature:devtools:${tool}`)
    return undefined
  }, [feature, tool])
  return <Dialog open={feature !== null} modal={false} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent showCloseButton={false} onInteractOutside={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()} className="feature-page-overlay !inset-x-0 !top-9 !bottom-0 !z-[35] !m-0 flex !h-[calc(100dvh-36px)] !w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 !rounded-none border-0 bg-background p-0 shadow-none !animate-none">
      <DialogTitle className="sr-only">{feature === "todos" ? "待办" : "开发工具"}</DialogTitle>
      <DialogDescription className="sr-only">覆盖在当前页面上的独立工具，关闭后继续使用原页面。</DialogDescription>
      <div className="flex h-full min-h-0 w-full [&>div]:!h-full [&>div]:!min-h-0">
        <Suspense fallback={<div data-page-transition-loading role="status" className="grid flex-1 place-items-center text-sm text-muted-foreground">正在加载…</div>}>
          {feature === "todos" ? <Todos /> : feature === "devtools" ? <Tools selectedTool={tool} onSelectTool={onToolChange}><Suspense fallback={<div data-page-transition-loading role="status">正在加载工具…</div>}><Tool /></Suspense></Tools> : null}
        </Suspense>
      </div>
    </DialogContent>
  </Dialog>
}
