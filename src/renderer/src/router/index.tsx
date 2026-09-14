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
    },
    children: [
      {
        path: "console",
        name: "devtools-console",
        component: ConsolePage,
        meta: {
          title: "控制台",
          icon: "Terminal",
          description: "Console 日志查看与监听控制",
          group: "主要功能",
          order: 1
        }
      },
      {
        path: "performance",
        name: "devtools-performance",
        component: PerformancePage,
        meta: {
          title: "性能监控",
          icon: "BarChart3",
          description: "CPU、内存、渲染性能实时监控",
          group: "主要功能",
          order: 2
        }
      },
      {
        path: "system",
        name: "devtools-system",
        component: SystemPage,
        meta: {
          title: "系统信息",
          icon: "Monitor",
          description: "操作系统、运行环境、依赖版本信息",
          group: "主要功能",
          order: 3
        }
      },
      {
        path: "tools",
        name: "devtools-tools",
        component: ToolsPage,
        meta: {
          title: "开发工具",
          icon: "Wrench",
          description: "常用开发工具集合",
          group: "工具",
          order: 1
        }
      },
      {
        path: "storage",
        name: "devtools-storage",
        component: StoragePage,
        meta: {
          title: "数据存储",
          icon: "Database",
          description: "SQLite 数据库表查看",
          group: "工具",
          order: 2
        }
      },
      {
        path: "navigate",
        name: "devtools-navigate",
        component: NavigatePage,
        meta: {
          title: "页面跳转",
          icon: "FolderOpen",
          description: "快速跳转到应用各页面",
          group: "工具",
          order: 3
        }
      }
    ]
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
