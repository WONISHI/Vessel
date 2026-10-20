import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useDevToolsRouteTree } from "@/pages/debug/components/hooks/useDevToolsRouteTree"
import { useRouter } from "@vessel/react-router"
import { CheckSquare, ChevronDown } from "lucide-react"
import { Fragment } from "react"

/** Builds diagnostic navigation from route groups rather than duplicating page names. */
export function DiagnosticsBreadcrumb() {
  const tree = useDevToolsRouteTree()
  const router = useRouter()
  return (
    <nav aria-label="调试页面导航" className="diagnostics-breadcrumb flex h-12 shrink-0 items-center gap-3 border-b bg-white px-5 text-[13px] text-stone-500">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-stone-100">
          <CheckSquare className="size-3.5" />调试页面<ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {tree?.groups.map((group, index) => (
            <Fragment key={group.name}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{String(group.meta?.title ?? "")}</DropdownMenuLabel>
              {group.children?.map((page) => (
                <DropdownMenuItem key={page.name} onSelect={() => { void router.push({ name: page.name }) }}>
                  {String(page.meta?.title ?? "")}
                </DropdownMenuItem>
              ))}
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-stone-300">/</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-stone-100">
          {String(tree?.currentGroup?.meta?.title ?? "主要功能")}<ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {tree?.currentGroup?.children?.map((page) => (
            <DropdownMenuItem key={page.name} onSelect={() => { void router.push({ name: page.name }) }}>
              {String(page.meta?.title ?? "")}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-stone-300">/</span>
      <span aria-current="page" className="font-semibold text-green-600">{String(tree?.currentPage?.meta?.title ?? "")}</span>
    </nav>
  )
}
