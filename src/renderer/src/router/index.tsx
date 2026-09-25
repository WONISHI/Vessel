import { useState } from "react"

import App, { type WorkspaceData } from "../App"
import Layout from "@/layout/index"
import Welcome from "@/pages/welcome/index"
import DebugPage from "@/pages/debug/index"
import DevtoolsConsole from "@/pages/debug/devtools-console"
import DevtoolsStorage from "@/pages/debug/devtools-storage"

import { createRouter, createWebHashHistory, type AppRouteRecordRaw } from "@/lib/react-router"

const STORAGE_KEY = "app_current_workspace"

/**
 * @description 读取当前工作区。
 *
 * 从 localStorage 中读取当前保存的工作区数据。
 * 当缓存不存在或解析失败时返回 null。
 *
 * @returns 当前工作区数据，不存在时返回 null。
 */
function readCurrentWorkspace(): WorkspaceData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    return saved ? JSON.parse(saved) : null
  } catch (error) {
    console.error("读取工作区缓存失败", error)

    return null
  }
}

/**
 * @description 保存当前工作区。
 *
 * 将当前工作区序列化后保存到 localStorage，
 * 供编辑器页面以及路由守卫读取。
 *
 * @param data 当前工作区数据。
 */
function saveCurrentWorkspace(data: WorkspaceData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * @description 欢迎页路由适配组件。
 *
 * 为 Welcome 注入工作区进入回调，
 * 当用户进入工作区时保存当前工作区数据。
 */
function WelcomeRoute() {
  return <Welcome onEnter={saveCurrentWorkspace} />
}

/**
 * @description 编辑器路由适配组件。
 *
 * 从本地缓存读取当前工作区，
 * 并将工作区数据传递给 Layout。
 *
 * 当不存在有效工作区时不渲染编辑器，
 * 正常情况下该情况会优先由路由守卫拦截。
 */
function EditorRoute() {
  const [workspace] = useState<WorkspaceData | null>(() => readCurrentWorkspace())

  if (!workspace) {
    return null
  }

  return <Layout workspace={workspace} />
}

/**
 * @description Vessel 路由配置。
 */
export const routes: AppRouteRecordRaw[] = [
  {
    path: "/",
    name: "welcome",
    component: WelcomeRoute,
    meta: {
      title: "首页"
    }
  },
  {
    path: "/editor",
    name: "editor",
    component: EditorRoute,
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
        component: DevtoolsConsole,
        meta: {
          title: "控制台",
          icon: "Terminal",
          description: "Console 日志查看与监听控制",
          group: "主要功能",
          order: 1
        }
      },
      {
        path: "storage",
        name: "devtools-storage",
        component: DevtoolsStorage,
        meta: {
          title: "数据存储",
          icon: "Database",
          description: "SQLite 数据库表查看",
          group: "工具",
          order: 1
        }
      }
    ]
  }
]

/**
 * @description 创建应用路由实例。
 *
 * Vessel 使用 Hash 路由，
 * 避免 Electron 本地文件环境下刷新页面时出现路径问题。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      component: App,
      children: routes
    }
  ]
})

/**
 * @description 工作区路由守卫。
 *
 * 当目标路由声明 requiresWorkspace，
 * 但当前没有保存的工作区时，
 * 自动返回欢迎页。
 */
router.beforeEach((to) => {
  const requiresWorkspace = to.meta.requiresWorkspace === true

  if (!requiresWorkspace) {
    return true
  }

  const currentWorkspace = readCurrentWorkspace()

  if (!currentWorkspace) {
    return {
      name: "welcome"
    }
  }

  return true
})

/**
 * @description 路由切换完成后更新页面标题。
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

/**
 * @description 监听路由执行异常。
 */
router.onError((error) => {
  console.error("路由执行失败", error)
})

export default router
