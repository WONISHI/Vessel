import { type ElementType } from "react"
import { ChevronDown, SquareCheckBig } from "lucide-react"
import { RouterView } from "@/lib/react-router/components"
import { useRouter, type AppRouteRecordRaw } from "@/lib/react-router"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useDevToolsRouteTree } from "./hooks/useDevToolsRouteTree"
import Check from "@/assets/vessel-icons/ui/check.svg?react"

type RouteIconComponent = ElementType<{
  className?: string
}>

const dropdownContentClassName = `
  z-[1000]
  !min-w-[180px]
  overflow-hidden
  !rounded-[10px]
  !border
  !border-[#e7e5e4]
  !bg-white
  !p-0
  shadow-[0_10px_40px_rgba(0,0,0,0.12)]
  data-[state=open]:animate-in
  data-[state=open]:fade-in-0
  data-[state=open]:slide-in-from-top-1
  data-[state=open]:duration-150
`

const dropdownLabelClassName = `
  !px-3
  !pb-1
  !pt-2
  text-[10px]
  font-bold
  uppercase
  tracking-[0.5px]
  !text-[#a8a29e]
`

const dropdownSeparatorClassName = `
  !mx-0
  !my-1
  !h-px
  !bg-[#f0efed]
`

const dropdownItemClassName = `
  min-h-0
  cursor-pointer
  gap-2
  !rounded-none
  !px-3
  !py-2
  text-[13px]
  font-normal
  !text-[#44403c]
  outline-none
  transition-all
  duration-100
  focus:!bg-[#faf9f7]
  focus:!text-[#1c1917]
`

const dropdownActiveItemClassName = `
  !bg-[#f0fdf4]
  font-semibold
  !text-[#15803d]
  focus:!bg-[#f0fdf4]
  focus:!text-[#15803d]
`

/**
 * 获取路由标题。
 */
function getRouteTitle(route: AppRouteRecordRaw | undefined, fallback: string): string {
  const title = route?.meta?.title

  return typeof title === "string" ? title : fallback
}

/**
 * 获取路由 SVG 图标组件。
 *
 * 路由中的 SVG 必须通过 ?react 导入：
 * import Icon from "./icon.svg?react"
 */
function getRouteIcon(route: AppRouteRecordRaw | undefined): RouteIconComponent | undefined {
  const icon = route?.meta?.icon

  if (!icon || typeof icon === "string") {
    return undefined
  }

  return icon as RouteIconComponent
}

/**
 * 获取分组中的第一个页面。
 */
function getFirstPage(group: AppRouteRecordRaw): AppRouteRecordRaw | undefined {
  return group.children?.find((route) => {
    return typeof route.name === "string"
  })
}

export default function DevToolsIndex() {
  const router = useRouter()
  const routeTree = useDevToolsRouteTree()

  if (!routeTree) {
    return <div className="flex h-full w-full flex-col" />
  }

  const { root, groups, currentGroup, currentPage } = routeTree

  /**
   * 点击分组时进入该分组的第一个页面。
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
   * 点击具体页面。
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
    <div className="flex h-full w-full flex-col">
      <Breadcrumb
        className="
          relative
          flex shrink-0
          items-center
          border-b
          border-[#f0efed]
          bg-white
          px-4 py-2
        "
      >
        <BreadcrumbList
          className="
            flex-nowrap
            gap-1
            sm:gap-1
          "
        >
          {/* 第一层：调试页面 */}
          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="
                    group
                    relative
                    flex cursor-pointer
                    select-none
                    items-center
                    gap-[5px]
                    rounded-md
                    px-[10px]
                    py-[5px]
                    text-[13px]
                    font-normal
                    text-[#78716c]
                    outline-none
                    transition-all
                    duration-[120ms]
                    hover:bg-[#faf9f7]
                    hover:text-[#1c1917]
                    data-[state=open]:bg-[#faf9f7]
                    data-[state=open]:text-[#1c1917]
                  "
                >
                  <SquareCheckBig
                    className="
                      h-[14px]
                      w-[14px]
                      shrink-0
                    "
                  />

                  <span>{getRouteTitle(root, "调试页面")}</span>

                  <ChevronDown
                    className="
                      h-3
                      w-3
                      shrink-0
                      opacity-60
                      transition-transform
                      duration-150
                      group-data-[state=open]:rotate-180
                    "
                  />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                alignOffset={0}
                sideOffset={4}
                collisionPadding={8}
                className={dropdownContentClassName}
              >
                <DropdownMenuLabel className={dropdownLabelClassName}>选择分组</DropdownMenuLabel>

                <DropdownMenuSeparator className={dropdownSeparatorClassName} />

                {groups.map((group) => {
                  const Icon = getRouteIcon(group)

                  const isActive = group.name === currentGroup?.name

                  return (
                    <DropdownMenuItem
                      key={group.name}
                      className={cn(dropdownItemClassName, isActive && dropdownActiveItemClassName)}
                      onSelect={() => {
                        handleGroupNavigate(group)
                      }}
                    >
                      {Icon && <Icon className={cn("!h-4 !w-4 shrink-0", isActive ? "text-[#16a34a]" : "text-[#78716c]")} />}

                      <span>{getRouteTitle(group, String(group.name))}</span>

                      {isActive && (
                        <Check
                          className="
                            ml-auto
                            !h-[14px]
                            !w-[14px]
                            shrink-0
                            text-[#16a34a]
                          "
                        />
                      )}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>

          {/* 第一层与第二层分隔符 */}
          {currentGroup && (
            <BreadcrumbSeparator
              className="
                select-none
                text-xs
                text-[#d6d3d1]
              "
            >
              /
            </BreadcrumbSeparator>
          )}

          {/* 第二层：当前分组 */}
          {currentGroup && (
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="
                      group
                      relative
                      flex cursor-pointer
                      select-none
                      items-center
                      gap-[5px]
                      rounded-md
                      px-[10px]
                      py-[5px]
                      text-[13px]
                      font-normal
                      text-[#78716c]
                      outline-none
                      transition-all
                      duration-[120ms]
                      hover:bg-[#faf9f7]
                      hover:text-[#1c1917]
                      data-[state=open]:bg-[#faf9f7]
                      data-[state=open]:text-[#1c1917]
                    "
                  >
                    <span>{getRouteTitle(currentGroup, "分组")}</span>

                    <ChevronDown
                      className="
                        h-3
                        w-3
                        shrink-0
                        opacity-60
                        transition-transform
                        duration-150
                        group-data-[state=open]:rotate-180
                      "
                    />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="start"
                  alignOffset={0}
                  sideOffset={4}
                  collisionPadding={8}
                  className={dropdownContentClassName}
                >
                  <DropdownMenuLabel className={dropdownLabelClassName}>{getRouteTitle(currentGroup, "选择页面")}</DropdownMenuLabel>

                  <DropdownMenuSeparator className={dropdownSeparatorClassName} />

                  {currentGroup.children?.map((page) => {
                    const Icon = getRouteIcon(page)

                    const isActive = page.name === currentPage?.name

                    return (
                      <DropdownMenuItem
                        key={page.name}
                        className={cn(dropdownItemClassName, isActive && dropdownActiveItemClassName)}
                        onSelect={() => {
                          handlePageNavigate(page)
                        }}
                      >
                        {Icon && <Icon className={cn("!h-4 !w-4 shrink-0", isActive ? "text-[#16a34a]" : "text-[#78716c]")} />}

                        <span>{getRouteTitle(page, String(page.name))}</span>

                        {isActive && (
                          <Check
                            className="
                                ml-auto
                                !h-[14px]
                                !w-[14px]
                                shrink-0
                                text-[#16a34a]
                              "
                          />
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
          )}

          {/* 第二层与第三层分隔符 */}
          {currentPage && (
            <BreadcrumbSeparator
              className="
                select-none
                text-xs
                text-[#d6d3d1]
              "
            >
              /
            </BreadcrumbSeparator>
          )}

          {/* 第三层：当前页面 */}
          {currentPage && (
            <BreadcrumbItem>
              <BreadcrumbPage
                className="
                  cursor-default
                  select-none
                  rounded-md
                  px-[10px]
                  py-[5px]
                  text-[13px]
                  font-semibold
                  text-[#16a34a]
                "
              >
                {getRouteTitle(currentPage, "当前页面")}
              </BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <RouterView />
    </div>
  )
}
