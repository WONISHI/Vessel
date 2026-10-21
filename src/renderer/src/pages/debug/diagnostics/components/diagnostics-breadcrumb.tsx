import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useDevToolsRouteTree } from "@/pages/debug/components/hooks/useDevToolsRouteTree"
import { useRouter } from "@vessel/react-router"
import { Check, CheckSquare, ChevronDown, Terminal, Wrench } from "lucide-react"

/** Route-derived three-level breadcrumb matching the debug design. */
export function DiagnosticsBreadcrumb() {
  const tree = useDevToolsRouteTree()
  const router = useRouter()
  const groupTitle = String(tree?.currentGroup?.meta?.title ?? "主要功能")
  return (
    <nav aria-label="调试页面导航" className="diagnostics-breadcrumb">
      <DropdownMenu>
        <DropdownMenuTrigger className="diagnostics-breadcrumb-trigger">
          <CheckSquare className="size-3.5" />调试页面<ChevronDown className="diagnostics-breadcrumb-chevron" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="diagnostics-breadcrumb-menu">
          <DropdownMenuLabel className="diagnostics-menu-label">选择分组</DropdownMenuLabel>
          {tree?.groups.map((group) => {
            const title = String(group.meta?.title ?? "")
            const Icon = title === "工具" ? Wrench : Terminal
            return (
              <DropdownMenuItem
                className="diagnostics-menu-item"
                key={group.name}
                onSelect={() => {
                  const page = group.children?.[0]
                  if (page?.name) void router.push({ name: page.name })
                }}
              >
                <Icon className="diagnostics-menu-icon" />{title}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="diagnostics-breadcrumb-separator">/</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="diagnostics-breadcrumb-trigger">
          {groupTitle}<ChevronDown className="diagnostics-breadcrumb-chevron" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="diagnostics-breadcrumb-menu">
          <DropdownMenuLabel className="diagnostics-menu-label">{groupTitle}</DropdownMenuLabel>
          {tree?.currentGroup?.children?.map((page) => (
            <DropdownMenuItem
              className="diagnostics-menu-item"
              aria-current={page.name === tree.currentPage?.name ? "page" : undefined}
              key={page.name}
              onSelect={() => { void router.push({ name: page.name }) }}
            >
              {String(page.meta?.title ?? "")}
              <Check aria-hidden="true" className="diagnostics-menu-check" />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="diagnostics-breadcrumb-separator">/</span>
      <span aria-current="page" className="diagnostics-breadcrumb-current">{String(tree?.currentPage?.meta?.title ?? "性能监控")}</span>
    </nav>
  )
}
