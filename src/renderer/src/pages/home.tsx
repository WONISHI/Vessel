import Logo from "@/assets/vessel.png"
import { Card, CardContent } from "@/components/ui/card"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FolderOpen, NotebookPen, Plus } from "lucide-react"

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
  const activeClassName = "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm active:scale-[0.98]"
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
    <div className="relative flex h-screen w-screen items-center justify-center bg-zinc-50">
      <Card className="relative w-full max-w-[420px] border-0 bg-transparent shadow-none">
        <CardContent className="flex flex-col items-center p-12">
          <div className="mb-8">
            <img
              src={Logo}
              className="w-16 h-16 object-contain opacity-90"
              alt="Vessel"
            />
          </div>

          <div className="flex flex-col w-full gap-3">
            <button
              onClick={handleOpenFolder}
              className="group flex h-12 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 text-sm text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.98]"
            >
              <span className="flex items-center gap-3">
                <FolderOpen className="h-4 w-4 text-teal-600" />
                {workspace ? "Change directory" : "Open workspace"}
              </span>
              <Plus className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
            </button>

            <button
              disabled={!workspace || loading}
              onClick={handleStart}
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                workspace ? activeClassName : "bg-zinc-100 text-zinc-300 cursor-not-allowed"
              }`}
            >
              <NotebookPen className="h-4 w-4" />
              Open editor
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
