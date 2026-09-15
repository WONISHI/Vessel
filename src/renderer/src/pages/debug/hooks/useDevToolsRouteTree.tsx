import { useRoute } from "@/lib/react-router"
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
    const groups = (root.children ?? []).filter((child) => {
      return child.meta?.routeType === "group"
    })

    /**
     * 当前分组。
     */
    const currentGroup = route.matched.find((matched) => {
      return matched.meta.routeType === "group"
    })?.record

    /**
     * 当前页面。
     */
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
