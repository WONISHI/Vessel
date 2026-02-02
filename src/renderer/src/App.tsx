import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import HomePage from './pages/home'
import Layout from './layout'
import { Toaster } from 'sonner'

// 统一工作区接口定义
export interface WorkspaceData {
  name: string;
  path: string;
  files: Array<{ name: string; path: string }>;
}

function App() {
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceData | null>(null)

  return (
    <>
      <Toaster position="top-center" richColors closeButton />
      <HashRouter>
        <Routes>
          {/* 首页 */}
          <Route
            path="/"
            element={<HomePage onEnter={(data) => setCurrentWorkspace(data)} />}
          />

          {/* 编辑器页面：包含 Layout 布局 */}
          <Route
            path="/editor"
            element={
              currentWorkspace ? (
                <Layout workspace={currentWorkspace}></Layout>
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