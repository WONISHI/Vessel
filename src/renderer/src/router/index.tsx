import { useState } from "react"

import App, { type WorkspaceData } from "../App"
import Layout from "@/layout/index"
import Welcome from "@/pages/welcome/index"
import DebugPage from "@/pages/debug/index"
import DevtoolsConsole from "@/pages/debug/devtools-console"
import DevtoolsStorage from "@/pages/debug/devtools-storage"
import WorkspaceHome from "@/layout/layout-main/workspace-home"
import Canvas from "@/layout/layout-main/canvas"

import { createRouter, createWebHashHistory, type AppRouteRecordRaw } from "@vessel/react-router"

const STORAGE_KEY = "app_current_workspace"

/**
 * 读取当前工作区
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
 * 保存当前工作区
 */
function saveCurrentWorkspace(data: WorkspaceData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * 欢迎页路由适配组件
 *
 * 给 Welcome 传递 onEnter。
 */
function WelcomeRoute() {
  return <Welcome onEnter={saveCurrentWorkspace} />
}

/**
 * 编辑器路由适配组件
 *
 * 给 Layout 传递 workspace。
 */
function EditorRoute() {
  const [workspace] = useState<WorkspaceData | null>(() => {
    return readCurrentWorkspace()
  })

  if (!workspace) {
    return null
  }

  return <Layout workspace={workspace} />
}

/**
 * 路由配置
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
    children: [
      { index: true, component: WorkspaceHome },
      { path: "file", name: "editor-file", component: Canvas }
    ],
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
        index: true,
        redirect: { name: "devtools-console" }
      },
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
      // {
      //   path: "performance",
      //   name: "devtools-performance",
      //   component: PerformancePage,
      //   meta: {
      //     title: "性能监控",
      //     icon: "BarChart3",
      //     description: "CPU、内存、渲染性能实时监控",
      //     group: "主要功能",
      //     order: 2
      //   }
      // },
      // {
      //   path: "system",
      //   name: "devtools-system",
      //   component: SystemPage,
      //   meta: {
      //     title: "系统信息",
      //     icon: "Monitor",
      //     description: "操作系统、运行环境、依赖版本信息",
      //     group: "主要功能",
      //     order: 3
      //   }
      // },
      // {
      //   path: "tools",
      //   name: "devtools-tools",
      //   component: ToolsPage,
      //   meta: {
      //     title: "开发工具",
      //     icon: "Wrench",
      //     description: "常用开发工具集合",
      //     group: "工具",
      //     order: 1
      //   }
      // },
      {
        path: "storage",
        name: "devtools-storage",
        component: DevtoolsStorage,
        meta: {
          title: "数据存储",
          icon: "Database",
          description: "SQLite 数据库表查看",
          group: "工具",
          order: 2
        }
      }
      // {
      //   path: "navigate",
      //   name: "devtools-navigate",
      //   component: NavigatePage,
      //   meta: {
      //     title: "页面跳转",
      //     icon: "FolderOpen",
      //     description: "快速跳转到应用各页面",
      //     group: "工具",
      //     order: 3
      //   }
      // }
    ]
  }
]

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
 * 工作区路由守卫
 *
 * 需要工作区但没有工作区时返回首页。
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

router.onError((error) => {
  console.error("路由执行失败", error)
})

export default router
