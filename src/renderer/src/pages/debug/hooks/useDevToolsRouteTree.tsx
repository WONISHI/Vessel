import { useRoute, type AppRouteRecordRaw } from "@vessel/react-router"
import { useMemo } from "react"
/**
 * 读取 devtools 路由树和当前匹配路由。
 */
export function useDevToolsRouteTree() {
  const route = useRoute()

  return useMemo(() => {
    /**
     * 第一层：调试页面。
     */
    const root = route.matched.find((matched) => matched.name === "devtools")?.record

    if (!root) {
      return null
    }

    /**
     * 第二层：主要功能、工具。
     */
    const groups: AppRouteRecordRaw[] = []
    for (const page of root.children ?? []) {
      if (!page.name || page.meta?.hidden) continue

      const title = typeof page.meta?.group === "string" ? page.meta.group : "其他"
      let group = groups.find((item) => item.meta?.title === title)
      if (!group) {
        group = { name: `devtools-group-${title}`, meta: { title }, children: [] }
        groups.push(group)
      }
      group.children!.push(page)
    }
    for (const group of groups) {
      group.children!.sort((a, b) => Number(a.meta?.order ?? 0) - Number(b.meta?.order ?? 0))
    }

    /**
     * 当前分组。
     */
    const currentGroup = groups.find((group) => group.children?.some((page) => route.matched.some((matched) => matched.name === page.name)))

    /**
     * 当前页面。
     */
    const currentPage = currentGroup?.children?.find((page) => route.matched.some((matched) => matched.name === page.name))

    return {
      root,
      groups,
      currentGroup,
      currentPage
    }
  }, [route.matched])
}
