import type { AppRouteRecordRaw } from "@/lib/react-router"
/**
 * 项目路由 meta
 */
export interface RouteMeta extends Record<string, unknown> {
  /** 页面标题 */
  title?: string
  /** 是否需要工作区才能访问 */
  requiresWorkspace?: boolean
  /** 是否在菜单中隐藏 */
  hidden?: boolean
}

/**
 * 项目路由记录
 */
export interface RouteRecord extends Omit<AppRouteRecordRaw, "path" | "name" | "component" | "meta"> {
  path: string
  name: string
  component: NonNullable<AppRouteRecordRaw["component"]>
  meta?: RouteMeta
}
