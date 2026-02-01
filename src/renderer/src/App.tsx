// src/renderer/src/App.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/home'
import Layout from './layout'
import { useState } from 'react'

// 定义类型
interface WorkspaceData {
  name: string;
  path: string;
  files: Array<{ name: string; path: string }>;
}

function App() {
  // 我们依然可以在 App 层记录当前工作区，或者通过路由状态传递
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceData | null>(null)

  const handleEnterWorkspace = (data: WorkspaceData) => {
    setCurrentWorkspace(data)
  }

  return (
    <HashRouter>
      <Routes>
        {/* 首页 */}
        <Route 
          path="/" 
          element={<HomePage onEnter={handleEnterWorkspace} />} 
        />
        
        {/* 编辑器页：包裹在 Layout 中 */}
        <Route 
          path="/editor" 
          element={
            currentWorkspace ? (
              <Layout workspace={currentWorkspace}>
                <div className="p-6">
                  <h1 className="text-2xl font-bold">欢迎使用 {currentWorkspace.name}</h1>
                </div>
              </Layout>
            ) : (
              <Navigate to="/" replace /> // 如果没选工作区，强行跳回首页
            )
          } 
        />
      </Routes>
    </HashRouter>
  )
}

export default App