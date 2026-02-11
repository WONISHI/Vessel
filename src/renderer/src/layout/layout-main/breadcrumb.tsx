import { useWorkspace } from "@renderer/layout/hooks/useWorkspace"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Fragment, useCallback, useMemo } from "react"

export default function BreadCrumb() {
  const { workspace, activeFilePath, changeCollapsible } = useWorkspace()

  // 使用 useCallback 包装函数，避免重复创建
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

  // 渲染面包屑项
  const renderBreadcrumbItems = useMemo(() => {
    if (segments.length === 0) return null

    return segments.map((segment, index) => {
      const isLast = index === segments.length - 1
      const currentPath = getPathForSegment(index)

      return (
        <Fragment key={`${segment}-${index}`}>
          <BreadcrumbItem>
            {isLast ? (
              <BreadcrumbPage className="font-medium text-slate-900">{segment}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink className="text-slate-500 hover:text-slate-700 transition-colors cursor-pointer" onClick={() => jumpRoute(currentPath)}>
                {segment}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {!isLast && <BreadcrumbSeparator />}
        </Fragment>
      )
    })
  }, [segments, getPathForSegment, jumpRoute])

  // 根节点路径
  const rootPath = workspace?.path || ""

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl justify-between">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer" />
        <Separator orientation="vertical" className="mr-2 h-4 bg-slate-300" />

        <Breadcrumb>
          <BreadcrumbList className="text-[12px] sm:text-[13px]">
            {/* 根节点：点击打开根目录 */}
            <BreadcrumbItem>
              <BreadcrumbLink className="font-semibold text-slate-700 hover:text-slate-900 cursor-pointer" onClick={() => jumpRoute(rootPath)}>
                {workspace?.name || "Workspace"}
              </BreadcrumbLink>
            </BreadcrumbItem>

            {segments.length > 0 && <BreadcrumbSeparator />}

            {renderBreadcrumbItems}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2">{/* 可以在这里添加其他控件，如保存按钮等 */}</div>
    </header>
  )
}
