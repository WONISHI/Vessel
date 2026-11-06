import App from "@/components/app/index"
import { RouterCrashFallback } from "@/components/core/error-boundary/crash-fallback"
import Canvas from "@/components/workspace/components/layout-main/canvas"
import { OfficeRoute } from "@/pages/office/index"
import { WelcomeRoute } from "@/pages/welcome/index"
import { createRouter, createWebHashHistory, type AppRouteRecordRaw } from "@vessel/react-router"
import type { WorkspaceData } from "@vessel/type"
import { RouteLoading, type RouteLoadingOptions } from "@/components/ui/route-loading"
import { lazyWithRetry } from "@/lib/lazy-retry"
import { Suspense, type ComponentType } from "react"
import { Bug, FolderOpen, GitBranch, Image as ImageIcon, ListTodo, Paperclip, Send, Settings } from "lucide-react"

/** 按路由懒加载重页面，加载期间显示统一的满宽加载蒙层（RouteLoading），各路由只传图标与文案 */
function lazyPage<P extends object>(factory: () => Promise<{ default: ComponentType<P> }>, loading: RouteLoadingOptions = {}): ComponentType<P> {
  const fallback = <RouteLoading {...loading} />
  const Page = lazyWithRetry(factory)
  return function LazyPage(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Page {...(props as any)} />
      </Suspense>
    )
  }
}

const debugLoading: RouteLoadingOptions = { icon: <Bug />, title: "正在加载调试工具", label: "正在准备开发者工具，请稍候…" }
const WorkspaceHome = lazyPage(() => import("@/components/workspace/components/layout-main/workspace-home"))
const SearchPage = lazyPage(() => import("@/pages/search/index"))
const EditorRoute = lazyPage<object>(async () => ({ default: (await import("@/pages/editor/index")).EditorRoute }))
const ResourceRoute = lazyPage<object>(async () => ({ default: (await import("@/pages/resources/index")).ResourceRoute }), { activity: "resources", icon: <FolderOpen />, title: "正在加载项目资源库", label: "正在准备项目资源库，请稍候…" })
const Base64Tool = lazyPage<object>(async () => ({ default: (await import("@/pages/debug/base64/index")).Base64Tool }), debugLoading)
const ColorTool = lazyPage<object>(async () => ({ default: (await import("@/pages/debug/color/index")).ColorTool }), debugLoading)
const JsonTool = lazyPage<object>(async () => ({ default: (await import("@/pages/debug/json/index")).JsonTool }), debugLoading)
const TranslateTool = lazyPage(() => import("@/pages/debug/translate"), debugLoading)
const URLTool = lazyPage<object>(async () => ({ default: (await import("@/pages/debug/url/index")).URLTool }), debugLoading)
const DiagnosticsPage = lazyPage(() => import("@/pages/debug/diagnostics/index"), debugLoading)
const DebugPage = lazyPage(() => import("@/pages/debug/index"), { ...debugLoading, activity: "tools" })
const DevtoolsStorage = lazyPage(() => import("@/pages/debug/storage/index"), debugLoading)
const PerformancePage = lazyPage(() => import("@/pages/debug/performance"), debugLoading)
const SystemInfoPage = lazyPage(() => import("@/pages/debug/system-info"), debugLoading)
/** 浏览器页由 BrowserKeepAlive 懒加载并常驻；路由本身不渲染内容（同 @/pages/browser 的 BrowserRoute），避免静态引入整个浏览器模块 */
function BrowserRoute() {
  return null
}
const SourceTreePage = lazyPage(() => import("@/pages/git/index"), { activity: "git", icon: <GitBranch />, title: "正在加载 Git", label: "正在读取仓库与提交记录，请稍候…" })
const AttachmentRoute = lazyPage(() => import("@/pages/attachments"), { activity: "attachments", icon: <Paperclip />, title: "正在加载附件库", label: "正在准备附件库，请稍候…" })
const ImageRoute = lazyPage(() => import("@/pages/image/index"), { activity: "image", icon: <ImageIcon />, title: "正在加载图片工具", label: "正在准备图片处理工作区，请稍候…" })
const PostmanPage = lazyPage(() => import("@/pages/postman/index"), { activity: "postman", icon: <Send />, title: "正在加载 API 调试", label: "正在准备请求工作区，请稍候…" })
const SettingsPage = lazyPage(() => import("@/pages/settings/index"), { icon: <Settings />, title: "正在加载设置", label: "正在读取偏好设置，请稍候…" })
const TodosPage = lazyPage(() => import("@/pages/todos/index"), { activity: "todos", icon: <ListTodo />, title: "正在加载待办", label: "正在读取待办事项，请稍候…" })
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
  { path: "/attachments", name: "attachments", component: AttachmentRoute, meta: { title: "附件库" } },
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
        { path: "url", component: URLTool, title: "URL 编解码" },
        { path: "translate", component: TranslateTool, title: "翻译" }
      ].map((tool) => ({ path: tool.path, name: `devtools-${tool.path}`, component: tool.component, meta: { title: tool.title } })),
      {
        index: true,
        redirect: { name: "devtools-json" }
      },
      { path: "console", redirect: { name: "devtools-performance" } },
      { path: "storage", redirect: { name: "devtools-storage" } },
      { path: "performance", redirect: { name: "devtools-performance" } },
      { path: "system", redirect: { name: "devtools-system" } }
    ]
  },
  {
    path: "/debug",
    name: "debug",
    component: DiagnosticsPage,
    meta: { title: "调试页面", hidden: true },
    children: [
      { index: true, redirect: { name: "devtools-performance" } },
      {
        path: "console",
        name: "devtools-console",
        redirect: { name: "devtools-performance" },
        meta: { hidden: true }
      },
      {
        path: "performance",
        name: "devtools-performance",
        component: PerformancePage,
        meta: { title: "性能监控", icon: "Activity", description: "CPU / 内存 / 帧率实时监控", group: "主要功能", order: 1 }
      },
      {
        path: "system",
        name: "devtools-system",
        component: SystemInfoPage,
        meta: { title: "系统信息", icon: "Monitor", description: "平台 / 分辨率 / 网络状态", group: "主要功能", order: 3 }
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
