import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { useState } from "react"
import { Toaster } from "sonner"
import DevTool from "@/components/core/devtool"
import { routes, type RouteRecord } from "./router"

export interface WorkspaceData {
  name: string
  path: string
  files: Array<{ name: string; path: string }>
}

const STORAGE_KEY = "app_current_workspace"

function App() {
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceData | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      console.error("读取工作区缓存失败", e)
      return null
    }
  })

  /**
   * 更新工作区：同时更新 State 和 LocalStorage
   */
  const handleSetWorkspace = (data: WorkspaceData) => {
    setCurrentWorkspace(data)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  /**
   * 根据路由配置渲染页面元素
   *
   * 类似 Vue Router 的路由守卫逻辑：
   * - requiresWorkspace: 没有工作区时重定向到首页
   * - 首页: 传入 onEnter 回调
   * - 编辑器: 传入 workspace
   * - 其他: 直接渲染
   */
  const renderElement = (route: RouteRecord) => {
    const Component = route.component

    // 需要工作区的路由：没有工作区时重定向到首页
    if (route.meta?.requiresWorkspace && !currentWorkspace) {
      return (
        <Navigate
          to="/"
          replace
        />
      )
    }

    // 首页：传入 onEnter 回调
    if (route.name === "welcome") {
      return <Component onEnter={handleSetWorkspace} />
    }

    // 编辑器：传入 workspace
    if (route.name === "editor") {
      return <Component workspace={currentWorkspace} />
    }

    // 其他页面：直接渲染
    return <Component />
  }

  return (
    <>
      <Toaster
        position="top-center"
        richColors
        closeButton
      />
      <HashRouter>
        <DevTool />
        <Routes>
          {/* 遍历路由配置表生成 Route（类似 Vue Router 的 routes 数组） */}
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={renderElement(route)}
            />
          ))}
        </Routes>
      </HashRouter>
    </>
  )
}

export default App
