import { useWorkspace } from "@renderer/layout/hooks/useWorkspace"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Fragment, useCallback, useMemo } from "react"

export default function BreadCrumb() {
  const { workspace, activeFilePath, changeCollapsible } = useWorkspace()

  const jumpRoute = useCallback(
    (fullPath?: string) => {
      if (!fullPath) return
      changeCollapsible(fullPath)
    },
    [changeCollapsible]
  )

  const normalizedWorkspacePath = useMemo(() => {
    if (!workspace?.path) return ""
    return workspace.path.replace(/[\\/]+$/, "")
  }, [workspace])

  const segments = useMemo(() => {
    if (!workspace || !Object.keys(workspace).length || !activeFilePath) {
      return []
    }
    try {
      const normalizedPath = workspace?.path ? workspace.path.replace(/[\\/]+$/, "") : ""
      if (normalizedPath && activeFilePath.startsWith(normalizedPath)) {
        const relativePath = activeFilePath.substring(normalizedPath.length)
        return relativePath.split(/[\\/]/).filter(Boolean)
      } else {
        return activeFilePath.split(/[\\/]/).filter(Boolean)
      }
    } catch (e) {
      console.error("Breadcrumb parsing error", e)
      return []
    }
  }, [workspace, activeFilePath])

  const getPathForSegment = useCallback(
    (index: number) => {
      if (!normalizedWorkspacePath || index < 0 || index >= segments.length) return ""
      const pathSegments = segments.slice(0, index + 1)
      return `${normalizedWorkspacePath}/${pathSegments.join("/")}`
    },
    [normalizedWorkspacePath, segments]
  )

  const renderBreadcrumbItems = useMemo(() => {
    if (segments.length === 0) return null

    return segments.map((segment, index) => {
      const isLast = index === segments.length - 1
      const currentPath = getPathForSegment(index)

      return (
        <Fragment key={`${segment}-${index}`}>
          <BreadcrumbItem>
            {isLast ? (
              <BreadcrumbPage className="font-medium text-zinc-900">{segment}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink
                className="text-zinc-500 hover:text-zinc-700 transition-colors cursor-pointer"
                onClick={() => jumpRoute(currentPath)}
              >
                {segment}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {!isLast && <BreadcrumbSeparator />}
        </Fragment>
      )
    })
  }, [segments, getPathForSegment, jumpRoute])

  const rootPath = workspace?.path || ""

  return (
    <header className="sticky top-0 z-10 flex h-12 items-center border-b border-zinc-200/60 bg-white/80 px-4 backdrop-blur-md justify-between">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="h-7 w-7 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer" />
        <Separator
          orientation="vertical"
          className="mr-1 h-4 bg-zinc-300"
        />

        <Breadcrumb>
          <BreadcrumbList className="text-[12px]">
            <BreadcrumbItem>
              <BreadcrumbLink
                className="font-semibold text-zinc-700 hover:text-zinc-900 cursor-pointer"
                onClick={() => jumpRoute(rootPath)}
              >
                {workspace?.name || "Workspace"}
              </BreadcrumbLink>
            </BreadcrumbItem>

            {segments.length > 0 && <BreadcrumbSeparator />}

            {renderBreadcrumbItems}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2" />
    </header>
  )
}
