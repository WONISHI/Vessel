import { useState } from "react"

import App, { type WorkspaceData } from "../App"
import Layout from "@/layout/index"
import Welcome from "@/pages/welcome/index"
import DebugPage from "@/pages/debug/index"
import CheckCircle from "@/assets/vessel-icons/ui/check-circle.svg?react"

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
      },
      {
        path: "devtools",
        name: "devtools",
        meta: {
          key: "devtools",
          title: "调试页面",
          icon: CheckCircle,
          routeType: "root",
          hidden: true
        },
        children: [
          {
            index: true,
            redirect: {
              name: "devtools-console"
            }
          },
          {
            name: "devtools-main-group",
            meta: {
              key: "main",
              title: "主要功能",
              routeType: "group",
              hidden: true
            },
            children: [
              {
                path: "console",
                name: "devtools-console",
                component: DebugPage,
                meta: {
                  key: "console",
                  title: "控制台",
                  description: "Console 日志查看与监听控制",
                  routeType: "page",
                  group: "main",
                  hidden: true
                }
              },
              {
                path: "performance",
                name: "devtools-performance",
                component: DebugPage,
                meta: {
                  key: "performance",
                  title: "性能监控",
                  description: "CPU / 内存 / 帧率实时监控",
                  routeType: "page",
                  group: "main",
                  hidden: true
                }
              },
              {
                path: "system",
                name: "devtools-system",
                component: DebugPage,
                meta: {
                  key: "system",
                  title: "系统信息",
                  description: "平台 / 分辨率 / 网络状态",
                  routeType: "page",
                  group: "main",
                  hidden: true
                }
              }
            ]
          },
          {
            name: "devtools-tools-group",
            meta: {
              key: "tools",
              title: "工具",
              routeType: "group",
              hidden: true
            },
            children: [
              {
                path: "tools",
                name: "devtools-tools",
                component: DebugPage,
                meta: {
                  key: "tools",
                  title: "开发工具",
                  description: "快捷操作入口",
                  routeType: "page",
                  group: "tools",
                  hidden: true
                }
              },
              {
                path: "storage",
                name: "devtools-storage",
                component: DebugPage,
                meta: {
                  key: "storage",
                  title: "数据存储",
                  description: "SQLite 数据库表查看",
                  routeType: "page",
                  group: "tools",
                  hidden: true
                }
              },
              {
                path: "navigate",
                name: "devtools-navigate",
                component: DebugPage,
                meta: {
                  key: "navigate",
                  title: "页面跳转",
                  description: "快速跳转到其他页面",
                  routeType: "page",
                  group: "tools",
                  hidden: true
                }
              }
            ]
          }
        ]
      }
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
