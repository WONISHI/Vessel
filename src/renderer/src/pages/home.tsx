import Logo from "@/assets/logo.png"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FolderOpen, NotebookPen, ChevronRight, FolderCheck } from "lucide-react"

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

  return (
    <div className="relative flex min-h-screen w-screen flex-col bg-white">
      {/*
        顶部 logo：
        - 窄屏：px-5 pt-5，logo 24px
        - 中屏以上：px-10 pt-8，logo 28px
      */}
      <div className="flex items-center gap-2 px-5 pt-5 sm:px-10 sm:pt-8">
        <img
          src={Logo}
          alt="Vessel"
          className="h-6 w-6 object-contain sm:h-7 sm:w-7"
        />
        <span className="text-sm font-semibold text-stone-900">Vessel</span>
      </div>

      {/*
        居中内容区：
        - 窄屏：px-5 py-8
        - 中屏以上：px-10 py-10
      */}
      <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10 sm:py-10">
        {/*
          容器最大宽度响应式：
          - 窄屏：max-w-full（占满）
          - 中屏：max-w-[480px]
          - 宽屏：max-w-[520px]
        */}
        <div className="w-full max-w-full sm:max-w-[480px] lg:max-w-[520px]">
          {/* 进度指示器 */}
          <div className="mb-6 flex items-center gap-2 sm:mb-8">
            <div className="h-1.5 w-6 rounded-full bg-stone-900" />
            <div className="h-1.5 w-1.5 rounded-full bg-stone-300" />
          </div>

          {/*
            大标题响应式：
            - 窄屏：text-2xl（24px）
            - 中屏：text-[28px]
            - 宽屏：text-[32px]
          */}
          <h1 className="mb-3 text-2xl font-bold leading-tight tracking-tight text-stone-900 sm:text-[28px] lg:text-[32px]">设置你的工作区</h1>

          {/*
            副标题响应式：
            - 窄屏：text-sm（14px）
            - 中屏以上：text-[15px]
          */}
          <p className="mb-8 text-sm leading-relaxed text-stone-400 sm:mb-10 sm:text-[15px]">选择一个本地文件夹，Vessel 会将你的笔记和数据保存在这里</p>

          {/* 表单：工作区路径 */}
          <div className="mb-8">
            <label className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              <FolderOpen className="h-3.5 w-3.5" />
              工作区路径
            </label>

            {/*
              输入框 + 按钮组合：
              - 窄屏：flex-col 堆叠，按钮全宽在下方
              - 中屏以上：flex-row 并排，按钮在右侧
            */}
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              {/* 路径输入框（只读） */}
              <div className="flex h-11 flex-1 items-center rounded-xl border border-stone-200 bg-stone-50 px-4">
                {workspace ? <span className="truncate text-sm text-stone-700">{workspace.path}</span> : <span className="text-sm text-stone-400">尚未选择文件夹</span>}
              </div>

              {/* 选择文件夹按钮 */}
              <button
                onClick={handleOpenFolder}
                disabled={loading}
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] disabled:opacity-60 sm:justify-start"
              >
                <FolderCheck className="h-4 w-4 text-green-700" />
                选择文件夹
              </button>
            </div>

            {/* 已选工作区的文件数提示 */}
            {workspace && (
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-xs text-stone-500">
                  已识别 <span className="font-medium text-stone-700">{workspace.files.length}</span> 个支持的文件
                </span>
              </div>
            )}
          </div>

          {/*
            主按钮：全宽，响应式高度
            - 窄屏：h-11
            - 中屏以上：h-12
          */}
          <button
            disabled={!workspace || loading}
            onClick={handleStart}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-300 sm:h-12 ${
              workspace ? "bg-green-700 text-white hover:bg-green-800 active:scale-[0.99]" : "cursor-not-allowed bg-stone-100 text-stone-300"
            }`}
          >
            <NotebookPen className="h-4 w-4" />
            打开编辑器
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* 底部提示 */}
          <p className="mt-8 text-center text-xs text-stone-400">数据保存在本地，无需联网 · 支持 Markdown / 富文本 / 图片</p>
        </div>
      </div>
    </div>
  )
}
