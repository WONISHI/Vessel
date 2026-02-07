import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import HomePage from './pages/home'
import Layout from './layout/index'
import { Toaster } from 'sonner'
import DevTool from '@/components/core/devtool' // 假设你放在这里

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
      
      {/* ✅ DevTool 必须放在 HashRouter 里面 */}
      <HashRouter>
        {/* 调试工具：放在 Router 内部才能使用 useNavigate */}
        <DevTool />

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