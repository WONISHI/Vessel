import Logo from "@/assets/logo.png"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FolderOpen, NotebookPen, Plus, CheckCircle2, Sparkles, Shield, Zap } from "lucide-react"

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
      navigate(`/editor`)
    }
  }

  const features = [
    { icon: Shield, text: "本地优先，数据完全属于你" },
    { icon: Zap, text: "毫秒级启动，即开即用" },
    { icon: Sparkles, text: "Markdown + 富文本混合编辑" }
  ]

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#faf9f7]">
      {/* 背景装饰：淡绿色径向光晕 */}
      <div className="pointer-events-none absolute -top-40 -left-20 h-[500px] w-[500px] rounded-full bg-green-100/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[400px] w-[400px] rounded-full bg-stone-200/30 blur-3xl" />

      {/* 两栏容器 */}
      <div className="relative z-10 grid w-full max-w-[880px] grid-cols-1 items-center gap-12 px-8 md:grid-cols-2 md:gap-16">
        {/* ========== 左栏：品牌展示 ========== */}
        <div className="flex flex-col justify-center">
          {/* Logo */}
          <div className="relative mb-8">
            <div className="absolute inset-0 -z-10 scale-[2] rounded-full bg-green-50/50 blur-2xl" />
            <img
              src={Logo}
              className="h-24 w-24 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.07)]"
              alt="Vessel"
            />
          </div>

          {/* 标题 & 描述 */}
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-stone-900">Vessel</h1>
          <p className="mb-10 text-base leading-relaxed text-stone-500">
            本地优先的可视化笔记工作区，
            <br />
            让你的知识在无限画布上自由生长。
          </p>

          {/* 特性列表 */}
          <div className="flex flex-col gap-4">
            {features.map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50">
                  <Icon className="h-4 w-4 text-green-700" />
                </div>
                <span className="text-sm text-stone-600">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ========== 右栏：操作区 ========== */}
        <div className="flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="mb-1 text-lg font-semibold text-stone-900">开始使用</h2>
            <p className="text-sm text-stone-400">选择一个本地文件夹作为你的工作区</p>
          </div>

          {/* 按钮组 */}
          <div className="flex flex-col gap-3">
            {/* 打开工作区按钮 */}
            <button
              onClick={handleOpenFolder}
              disabled={loading}
              className="group flex h-12 w-full items-center justify-between rounded-2xl border border-stone-200 bg-white px-5 text-sm font-medium text-stone-700 transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <FolderOpen className="h-4 w-4 text-green-700" />
                {workspace ? "更换工作目录" : "打开工作区"}
              </span>
              {workspace ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Plus className="h-4 w-4 text-stone-300 transition-colors group-hover:text-stone-500" />}
            </button>

            {/* 已选工作区路径提示 */}
            {workspace && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50/80 px-4 py-2.5">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                <span className="truncate text-xs text-green-800">{workspace.path}</span>
                <span className="ml-auto shrink-0 text-xs font-medium text-green-600">{workspace.files.length} 个文件</span>
              </div>
            )}

            {/* 进入编辑器按钮 */}
            <button
              disabled={!workspace || loading}
              onClick={handleStart}
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-all duration-300 ${
                workspace ? "bg-green-700 text-white hover:bg-green-800 active:scale-[0.98]" : "cursor-not-allowed bg-stone-100 text-stone-300"
              }`}
            >
              <NotebookPen className="h-4 w-4" />
              打开编辑器
            </button>
          </div>

          {/* 底部提示 */}
          <p className="mt-8 text-center text-xs text-stone-400">数据保存在本地，无需联网 · 支持 Markdown / 富文本</p>
        </div>
      </div>
    </div>
  )
}
