import Logo from '@/assets/vessel.png'
import { Card, CardContent } from '@/components/ui/card'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, NotebookPen, Loader2, Sparkles, Plus } from 'lucide-react'

interface WorkspaceData {
  name: string
  path: string
  files: Array<{ name: string; path: string }>
}

interface HomePageProps {
  onEnter?: (data: WorkspaceData) => void
}

export default function HomePage({ onEnter }: HomePageProps) {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleOpenFolder = async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.openDirectory()
      if (data) setWorkspace(data)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = () => {
    if (workspace && onEnter) {
      onEnter(workspace)
      navigate(`/editor`) // 执行路由跳转
    }
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#fafafa] text-slate-900">
      {/* 背景装饰 */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.4]"></div>
      <div className="absolute left-[10%] top-[10%] -z-10 h-[500px] w-[500px] rounded-full bg-blue-100/40 blur-[120px]"></div>

      <Card className="relative w-full max-w-[440px] border-none bg-transparent shadow-none">
        <CardContent className="flex flex-col items-center p-12 bg-white/80 backdrop-blur-3xl rounded-[40px] border border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)]">
          <div className="relative mb-10 group cursor-default">
            <div className="absolute -inset-6 rounded-full bg-blue-50/80 opacity-0 blur-2xl transition-all duration-700 group-hover:opacity-100"></div>
            <img
              src={Logo}
              className="relative w-28 h-28 object-contain transition-all duration-500 group-hover:scale-105"
            />
          </div>

          <h1 className="mb-2 text-3xl font-light tracking-[0.4em] text-slate-800">VESSEL</h1>

          <div className="mb-12 text-center h-6">
            {workspace ? (
              <p className="text-sm font-medium text-blue-600 animate-in fade-in slide-in-from-bottom-2">
                已就绪: {workspace.name}
              </p>
            ) : (
              <p className="text-[10px] tracking-[0.2em] text-slate-400 uppercase font-bold italic">
                <Sparkles className="inline h-3 w-3 mr-1" /> Pure Experience
              </p>
            )}
          </div>

          <div className="flex flex-col w-full gap-5">
            <button
              onClick={handleOpenFolder}
              className="group relative flex h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white border border-slate-200 px-6 text-xs font-bold text-slate-600 transition-all hover:border-blue-300 hover:shadow-lg active:scale-[0.98]"
            >
              <FolderOpen className="h-4 w-4 text-blue-500" />
              <span className="flex-1 text-left uppercase tracking-widest">
                {workspace ? '更换目录' : '导入工作区'}
              </span>
              <Plus className="h-4 w-4 opacity-30 group-hover:rotate-90 group-hover:opacity-100 transition-all" />
            </button>

            <button
              disabled={!workspace || loading}
              onClick={handleStart}
              className={`flex h-16 w-full items-center justify-center gap-3 rounded-2xl px-6 text-xs font-black transition-all duration-500 ${workspace
                  ? 'bg-slate-900 text-white shadow-2xl hover:bg-black hover:-translate-y-1'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200/50'
                }`}
            >
              <NotebookPen className="h-4 w-4" />
              <span className="uppercase tracking-[0.2em]">开启笔记</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
