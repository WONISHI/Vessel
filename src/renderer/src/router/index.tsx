import { OfficeRoute } from "@/pages/office"
import { BrowserRoute } from "@/pages/browser/keep-alive"
import { useLocation } from "react-router-dom"
import TodosPage from "@/pages/todos"
import { useEffect, useState } from "react"

import App, { type WorkspaceData } from "../App"
import WorkspacePage from "@/pages/workspace"
import Welcome from "@/pages/welcome/index"
import DebugPage from "@/pages/debug/index"
import DevtoolsConsole from "@/pages/debug/devtools-console"
import DevtoolsStorage from "@/pages/debug/devtools-storage"
import WorkspaceHome from "@/pages/workspace/components/layout-main/workspace-home"
import Canvas from "@/pages/workspace/components/layout-main/canvas"

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
 * 给 WorkspacePage 传递 workspace。
 */
function EditorRoute() {
  const location = useLocation()
  const external = new URLSearchParams(location.search).get("external")
  if (external) return <ExternalEditor key={external} path={external} />
  return <CurrentEditor />
}

function ExternalEditor({ path }: { path: string }) {
  const name = path.split(/[\\/]/).pop() || path
  const parent = path.slice(0, path.length - name.length)
  const root = /^[A-Za-z]:[\\/]$/.test(parent) ? parent : parent.replace(/[\\/]$/, "") || "/"
  const workspace = { name: root.split(/[\\/]/).pop() || root, path: root, files: [{ name, path }] }
  return <WorkspacePage workspace={workspace} initialFile={path} />
}

function CurrentEditor() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(() => {
    return readCurrentWorkspace()
  })

  useEffect(() => {
    const update = () => setWorkspace(readCurrentWorkspace())
    window.addEventListener("vessel:workspace-changed", update)
    return () => window.removeEventListener("vessel:workspace-changed", update)
  }, [])

  if (!workspace) {
    return null
  }

  return <WorkspacePage key={workspace.path} workspace={workspace} />
}

function ResourceRoute() {
  const [project, setProject] = useState(() => JSON.parse(localStorage.getItem("resource_current_project") || "null") as (WorkspaceData & { initialFile?: string }) | null)
  useEffect(() => {
    const update = () => setProject(JSON.parse(localStorage.getItem("resource_current_project") || "null"))
    window.addEventListener("vessel:resource-changed", update)
    return () => window.removeEventListener("vessel:resource-changed", update)
  }, [])
  return project ? <WorkspacePage key={`${project.path}:${project.initialFile || ""}`} workspace={project} initialFile={project.initialFile} scope="resources" /> : <Welcome onEnter={data => localStorage.setItem("resource_current_project", JSON.stringify(data))} />
}

/**
 * 路由配置
 */
export const routes: AppRouteRecordRaw[] = [
  { path: "/office", name: "office", component: OfficeRoute, meta: { title: "ONLYOFFICE" } },
  { path: "/resources", name: "resources", component: ResourceRoute, meta: { title: "项目资源库" }, children: [
    { index: true, component: WorkspaceHome },
    { path: "file", name: "resources-file", component: Canvas }
  ] },
  { path: "/browser", name: "browser", component: BrowserRoute, meta: { title: "浏览器" } },
  {path: "/todos", name: "todos", component: TodosPage, meta: {title: "待办"}},
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

  if (!currentWorkspace && !to.fullPath.includes("external=")) {
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
