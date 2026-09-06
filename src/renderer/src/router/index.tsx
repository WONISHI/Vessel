import { useState } from "react"

import App, { type WorkspaceData } from "../App"
import Layout from "@/layout/index"
import Welcome from "@/pages/welcome/index"
// import DebugPage from "@/pages/debug/index"

import { createRouter, createWebHashHistory, type AppRouteRecordRaw } from "@/lib/react-router"

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
    component: App,
    children: [
      {
        index: true,
        name: "welcome",
        component: WelcomeRoute,
        meta: {
          title: "首页"
        }
      },
      {
        path: "editor",
        name: "editor",
        component: EditorRoute,
        meta: {
          title: "编辑器",
          requiresWorkspace: true
        }
      }
      // {
      //   path: "devtools",
      //   name: "devtools",
      //   component: DebugPage,
      //   meta: {
      //     title: "开发者工具",
      //     hidden: true
      //   }
      // }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
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
