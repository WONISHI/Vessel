import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom"
import { useState, useEffect } from "react"
import HomePage from "./pages/home"
import Layout from "./layout/index"
import { Toaster } from "sonner"
import DevTool from "@/components/core/devtool"

export interface WorkspaceData {
  name: string
  path: string
  files: Array<{ name: string; path: string }>
}

const STORAGE_KEY = "app_current_workspace"

function App() {
  const [currentWorkspace, setCurrentWorkspace] =
    useState<WorkspaceData | null>(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : null
      } catch (e) {
        console.error("读取工作区缓存失败", e)
        return null
      }
    })

  // 2. 封装一个更新函数：同时更新 State 和 LocalStorage
  const handleSetWorkspace = (data: WorkspaceData) => {
    setCurrentWorkspace(data)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  const handleClearWorkspace = () => {
    setCurrentWorkspace(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <>
      <Toaster position="top-center" richColors closeButton />

      <HashRouter>
        <DevTool />
        <Routes>
          {/* 首页 */}
          <Route
            path="/"
            element={
              <HomePage
                // 使用新的处理函数
                onEnter={handleSetWorkspace}
              />
            }
          />

          {/* 编辑器页面 */}
          <Route
            path="/editor"
            element={
              currentWorkspace ? (
                <Layout workspace={currentWorkspace} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </HashRouter>
    </>
  )
}

export default App
