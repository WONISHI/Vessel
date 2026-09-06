import Layout from "@/layout/index"
import Welcome from "@/pages/welcome/index"
// import DebugPage from "@/pages/debug/index"

import { createRouter, createWebHashHistory, type AppRouteRecordRaw } from "@/lib/react-router"

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

/**
 * 路由配置
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
  }
  // {
  //   path: "/devtools",
  //   name: "devtools",
  //   component: DebugPage,
  //   meta: {
  //     title: "开发者工具",
  //     hidden: true
  //   }
  // }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

/**
 * 设置页面标题
 */
router.afterEach((to, _from, failure) => {
  if (failure) {
    return
  }

  const title = to.meta.title

  if (typeof title === "string") {
    document.title = title
  }
})

export default router
