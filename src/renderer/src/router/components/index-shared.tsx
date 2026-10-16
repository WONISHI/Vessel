import App from "@/components/app/index"
import { RouterCrashFallback } from "@/components/core/error-boundary/crash-fallback"
import Canvas from "@/components/workspace/components/layout-main/canvas"
import WorkspaceHome from "@/components/workspace/components/layout-main/workspace-home"
import { BrowserRoute } from "@/pages/browser"
import { Base64Tool, ColorTool, JsonTool, URLTool } from "@/pages/debug/components/utility-tools"
import DevtoolsConsole from "@/pages/debug/console/index"
import DiagnosticsPage from "@/pages/debug/diagnostics/index"
import DebugPage from "@/pages/debug/index"
import DevtoolsStorage from "@/pages/debug/storage/index"
import { EditorRoute } from "@/pages/editor/index"
import SourceTreePage from "@/pages/git/index"
import ImageRoute from "@/pages/image/index"
import { OfficeRoute } from "@/pages/office/index"
import PostmanPage from "@/pages/postman/index"
import { ResourceRoute } from "@/pages/resources/index"
import SearchPage from "@/pages/search/index"
import SettingsPage from "@/pages/settings/index"
import TodosPage from "@/pages/todos/index"
import { WelcomeRoute } from "@/pages/welcome/index"
import { createRouter, createWebHashHistory, type AppRouteRecordRaw } from "@vessel/react-router"
import type { WorkspaceData } from "@vessel/type"
export const STORAGE_KEY = "app_current_workspace"

/** Reads current workspace. */
export function readCurrentWorkspace(): WorkspaceData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    return saved ? JSON.parse(saved) : null
  } catch (error) {
    console.error("读取工作区缓存失败", error)

    return null
  }
}

/** Saves current workspace. */
export function saveCurrentWorkspace(data: WorkspaceData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
export const routes: AppRouteRecordRaw[] = [
  { path: "/git", name: "git", component: SourceTreePage, meta: { title: "Git" } },
  { path: "/api-client", name: "api-client", component: PostmanPage, meta: { title: "API" } },
  { path: "/search", name: "search", component: SearchPage, meta: { title: "全局搜索" } },
  { path: "/office", name: "office", component: OfficeRoute, meta: { title: "ONLYOFFICE" } },
  {
    path: "/resources",
    name: "resources",
    component: ResourceRoute,
    meta: { title: "项目资源库" },
    children: [
      { index: true, component: WorkspaceHome },
      { path: "file", name: "resources-file", component: Canvas }
    ]
  },
  { path: "/settings", name: "settings", component: SettingsPage, meta: { title: "设置" } },
  { path: "/browser", name: "browser", component: BrowserRoute, meta: { title: "浏览器" } },
  { path: "/todos", name: "todos", component: TodosPage, meta: { title: "待办" } },
  { path: "/image", name: "image", component: ImageRoute, meta: { title: "图片" } },
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
      ...[
        { path: "json", component: JsonTool, title: "JSON 格式化" },
        { path: "color", component: ColorTool, title: "颜色转换" },
        { path: "base64", component: Base64Tool, title: "Base64" },
        { path: "url", component: URLTool, title: "URL 编解码" }
      ].map((tool) => ({ path: tool.path, name: `devtools-${tool.path}`, component: tool.component, meta: { title: tool.title } })),
      {
        index: true,
        redirect: { name: "devtools-json" }
      },
      { path: "console", redirect: { name: "devtools-console" } },
      { path: "storage", redirect: { name: "devtools-storage" } }
    ]
  },
  {
    path: "/debug",
    name: "debug",
    component: DiagnosticsPage,
    meta: { title: "调试页面", hidden: true },
    children: [
      { index: true, redirect: { name: "devtools-console" } },
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
          order: 2
        }
      }
    ]
  }
]
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      component: App,
      errorElement: <RouterCrashFallback />,
      children: routes
    }
  ]
})

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
