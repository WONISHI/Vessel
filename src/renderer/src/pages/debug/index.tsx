import { useMemo } from "react"
import { CheckCircle2, ChevronDown, LayoutGrid, type LucideIcon } from "lucide-react"

import { useRoute, useRouter, type AppRouteRecordRaw } from "@/lib/react-router"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * 读取 devtools 路由树和当前匹配路由
 */
function useDevToolsRouteTree() {
  const route = useRoute()

  return useMemo(() => {
    const root = route.matched.find((matched) => matched.name === "devtools")?.record
    if (!root) {
      return null
    }
    const groups = (root.children ?? []).filter((child) => {
      return child.meta?.routeType === "group"
    })
    const currentGroup = route.matched.find((matched) => {
      return matched.meta.routeType === "group"
    })?.record

    const currentPage = route.matched.find((matched) => {
      return matched.meta.routeType === "page"
    })?.record

    return {
      root,
      groups,
      currentGroup,
      currentPage
    }
  }, [route.matched])
}

/**
 * 获取路由标题
 */
function getRouteTitle(route: AppRouteRecordRaw | undefined, fallback: string): string {
  const title = route?.meta?.title

  return typeof title === "string" ? title : fallback
}

/**
 * 获取路由图标
 */
function getRouteIcon(route: AppRouteRecordRaw | undefined): LucideIcon | undefined {
  return route?.meta?.icon as LucideIcon | undefined
}

/**
 * 获取分组中的第一个页面
 */
function getFirstPage(group: AppRouteRecordRaw): AppRouteRecordRaw | undefined {
  return group.children?.find((route) => {
    return route.meta?.routeType === "page" && typeof route.name === "string"
  })
}

export default function DevToolsIndex() {
  const router = useRouter()
  const routeTree = useDevToolsRouteTree()

  if (!routeTree) {
    return <div className="flex h-full flex-col bg-[#faf9f7]" />
  }

  const { root, groups, currentGroup, currentPage } = routeTree
  const RootIcon = getRouteIcon(root) ?? LayoutGrid

  /**
   * 点击分组时进入该分组的第一个页面
   */
  const handleGroupNavigate = (group: AppRouteRecordRaw) => {
    const firstPage = getFirstPage(group)

    if (typeof firstPage?.name !== "string") {
      return
    }

    void router.push({
      name: firstPage.name
    })
  }

  /**
   * 点击具体页面
   */
  const handlePageNavigate = (page: AppRouteRecordRaw) => {
    if (typeof page.name !== "string") {
      return
    }

    void router.push({
      name: page.name
    })
  }

  return (
    <div className="flex h-full flex-col w-full">
      <Breadcrumb className="flex h-11 shrink-0 items-center border-b border-[#e7e5e4] bg-white px-4">
        <BreadcrumbList className="gap-1 sm:gap-1">
          {/* 第一层：调试页面 */}
          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold text-stone-600 outline-none transition-colors hover:bg-[#faf9f7] hover:text-stone-900 data-[state=open]:bg-[#faf9f7]"
                >
                  <RootIcon className="h-3.5 w-3.5 text-stone-500" />

                  {getRouteTitle(root, "调试页面")}

                  <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                className="w-44"
              >
                <DropdownMenuLabel className="text-[11px] text-stone-400">选择分组</DropdownMenuLabel>

                <DropdownMenuSeparator />

                {groups.map((group) => {
                  const Icon = getRouteIcon(group)
                  const isActive = group.name === currentGroup?.name

                  return (
                    <DropdownMenuItem
                      key={group.name}
                      className={cn("cursor-pointer gap-2 text-[13px]", isActive && "bg-green-50 text-green-700 focus:bg-green-100 focus:text-green-800")}
                      onSelect={() => {
                        handleGroupNavigate(group)
                      }}
                    >
                      {Icon && <Icon className={cn("h-4 w-4", isActive ? "text-green-600" : "text-stone-500")} />}

                      {getRouteTitle(group, String(group.name))}

                      {isActive && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-green-600" />}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>

          {/* 第二层：当前分组 */}
          {currentGroup && (
            <>
              <BreadcrumbSeparator className="px-1 text-[13px] text-stone-300">/</BreadcrumbSeparator>

              <BreadcrumbItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold text-stone-600 outline-none transition-colors hover:bg-[#faf9f7] hover:text-stone-900 data-[state=open]:bg-[#faf9f7]"
                    >
                      {getRouteTitle(currentGroup, "分组")}

                      <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="start"
                    className="w-48"
                  >
                    <DropdownMenuLabel className="text-[11px] text-stone-400">{getRouteTitle(currentGroup, "选择页面")}</DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    {currentGroup.children
                      ?.filter((page) => {
                        return page.meta?.routeType === "page"
                      })
                      .map((page) => {
                        const Icon = getRouteIcon(page)
                        const isActive = page.name === currentPage?.name

                        return (
                          <DropdownMenuItem
                            key={page.name}
                            className={cn("cursor-pointer gap-2 text-[13px]", isActive && "bg-green-50 text-green-700 focus:bg-green-100 focus:text-green-800")}
                            onSelect={() => {
                              handlePageNavigate(page)
                            }}
                          >
                            {Icon && <Icon className={cn("h-4 w-4", isActive ? "text-green-600" : "text-stone-500")} />}

                            {getRouteTitle(page, String(page.name))}

                            {isActive && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-green-600" />}
                          </DropdownMenuItem>
                        )
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </BreadcrumbItem>
            </>
          )}

          {/* 第三层：当前页面 */}
          {currentPage && (
            <>
              <BreadcrumbSeparator className="px-1 text-[13px] text-stone-300">/</BreadcrumbSeparator>

              <BreadcrumbItem>
                <BreadcrumbPage className="rounded-md px-2 py-1 text-[13px] font-semibold text-green-600">{getRouteTitle(currentPage, "当前页面")}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
