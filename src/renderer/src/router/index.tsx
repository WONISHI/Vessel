import type { ComponentType } from "react"
import Welcome from "@/pages/welcome/index"
import Layout from "@/layout/index"
import DebugPage from "@/pages/debug/index"

/**
 * 路由 meta 信息（类似 Vue Router 的 meta）
 */
export interface RouteMeta {
  /** 页面标题 */
  title?: string
  /** 是否需要工作区才能访问 */
  requiresWorkspace?: boolean
  /** 是否在菜单中隐藏 */
  hidden?: boolean
}

/**
 * 路由记录（类似 Vue Router 的 RouteRecordRaw）
 */
export interface RouteRecord {
  /** 路由路径 */
  path: string
  /** 路由名称（唯一标识） */
  name: string
  /** 页面组件 */
  component: ComponentType<any>
  /** 附加信息 */
  meta?: RouteMeta
}

/**
 * 路由配置表
 *
 * 用法类似 Vue Router：
 * const router = createRouter({ routes })
 *
 * 这里通过遍历 routes 数组生成 <Route> 组件
 */
export const routes: RouteRecord[] = [
  {
    path: "/",
    name: "welcome",
    component: Welcome,
    meta: {
      title: "首页"
    }
  },
  {
    path: "/editor",
    name: "editor",
    component: Layout,
    meta: {
      title: "编辑器",
      requiresWorkspace: true
    }
  },
  {
    path: "/devtools",
    name: "devtools",
    component: DebugPage,
    meta: {
      title: "开发者工具",
      hidden: true
    }
  }
]

/**
 * 根据名称查找路由
 *
 * 用法类似 Vue Router 的 router.resolve({ name })
 */
export function findRouteByName(name: string): RouteRecord | undefined {
  return routes.find((route) => route.name === name)
}

/**
 * 根据路径查找路由
 */
export function findRouteByPath(path: string): RouteRecord | undefined {
  return routes.find((route) => route.path === path)
}
