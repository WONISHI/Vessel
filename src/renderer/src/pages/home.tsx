import Logo from "@/assets/logo.png"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FolderOpen, NotebookPen, ChevronRight, FolderCheck, LayoutGrid, WifiOff, Eye } from "lucide-react"

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
    { icon: LayoutGrid, text: "无限画布" },
    { icon: WifiOff, text: "离线可用" },
    { icon: Eye, text: "实时预览" }
  ]

  return (
    <div className="relative flex min-h-screen w-screen flex-col bg-white">
      {/* ========== 顶部 logo（仅小屏显示） ========== */}
      <div className="flex items-center gap-2 px-5 pt-5 sm:px-10 sm:pt-8 lg:hidden">
        <img
          src={Logo}
          alt="Vessel"
          className="h-6 w-6 object-contain sm:h-7 sm:w-7"
        />
        <span className="text-sm font-semibold text-stone-900">Vessel</span>
      </div>

      {/* ========== 内容区 ========== */}
      <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10 sm:py-10">
        <div className="grid w-full max-w-[520px] grid-cols-1 items-center gap-12 lg:max-w-[1000px] lg:grid-cols-2 lg:gap-16">
          {/* ========== 左栏：品牌展示（仅大屏显示） ========== */}
          <div className="hidden lg:flex lg:flex-col">
            <div className="mb-10">
              <img
                src={Logo}
                alt="Vessel"
                className="h-24 w-24 object-contain"
              />
            </div>

            <h1 className="mb-5 text-[40px] font-bold leading-[1.15] tracking-tight text-stone-900">
              让知识在
              <br />
              画布上自由生长
            </h1>

            <p className="mb-10 max-w-[420px] text-base leading-relaxed text-stone-500">Vessel 是本地优先的可视化笔记工作区，支持 Markdown 与富文本混合编辑，你的数据完全属于自己。</p>

            <div className="flex flex-wrap gap-3">
              {features.map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2"
                >
                  <Icon className="h-3.5 w-3.5 text-green-700" />
                  <span className="text-xs font-medium text-stone-600">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ========== 右栏：表单区 ========== */}
          <div className="w-full">
            {/* 小屏标题区 */}
            <div className="lg:hidden">
              <div className="mb-6 flex items-center gap-2 sm:mb-8">
                <div className="h-1.5 w-6 rounded-full bg-stone-900" />
                <div className="h-1.5 w-1.5 rounded-full bg-stone-300" />
              </div>

              <h1 className="mb-3 text-2xl font-bold leading-tight tracking-tight text-stone-900 sm:text-[28px]">设置你的工作区</h1>

              <p className="mb-8 text-sm leading-relaxed text-stone-400 sm:mb-10 sm:text-[15px]">选择一个本地文件夹，Vessel 会将你的笔记和数据保存在这里</p>
            </div>

            {/* 大屏表单标题 */}
            <div className="mb-8 hidden lg:block">
              <h2 className="mb-1.5 text-xl font-semibold text-stone-900">开始使用</h2>
              <p className="text-sm text-stone-400">选择一个本地文件夹作为你的工作区</p>
            </div>

            {/* 表单：工作区路径 */}
            <div className="mb-8">
              <label className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                <FolderOpen className="h-3.5 w-3.5" />
                工作区路径
              </label>

              {/* 输入框 + 按钮：高度从 h-11(44px) 改成 h-10(40px) */}
              <div className="flex gap-2">
                <div className="flex h-10 min-w-0 flex-1 items-center rounded-xl border border-stone-200 bg-stone-50 px-4">
                  {workspace ? <span className="truncate text-sm text-stone-700">{workspace.path}</span> : <span className="text-sm text-stone-400">尚未选择文件夹</span>}
                </div>

                <button
                  onClick={handleOpenFolder}
                  disabled={loading}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] disabled:opacity-60"
                >
                  <FolderCheck className="h-4 w-4 text-green-700" />
                  选择文件夹
                </button>
              </div>

              {workspace && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-xs text-stone-500">
                    已识别 <span className="font-medium text-stone-700">{workspace.files.length}</span> 个支持的文件
                  </span>
                </div>
              )}
            </div>

            {/* 主按钮：高度从 h-11 sm:h-12 改成 h-10(40px) */}
            <button
              disabled={!workspace || loading}
              onClick={handleStart}
              className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                workspace ? "bg-green-700 text-white hover:bg-green-800 active:scale-[0.99]" : "cursor-not-allowed bg-stone-100 text-stone-300"
              }`}
            >
              <NotebookPen className="h-4 w-4" />
              打开编辑器
              <ChevronRight className="h-4 w-4" />
            </button>

            <p className="mt-8 text-center text-xs text-stone-400">数据保存在本地，无需联网 · 支持 Markdown / 富文本 / 图片</p>
          </div>
        </div>
      </div>
    </div>
  )
}
