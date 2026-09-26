import { FolderOpen, File } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"

export default function WorkspaceHome() {
  const { workspace, openFiles, openWorkspaceFile } = useWorkspace()
  return (
    <div className="mx-auto w-full max-w-4xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-xl bg-emerald-50 p-3 text-green-700">
          <FolderOpen className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-stone-800">{workspace.name}</h1>
          <p className="mt-1 break-all text-xs text-stone-400">{workspace.path}</p>
        </div>
      </div>
      <section className="rounded-xl border border-[#f0efed] p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">本次打开</h2>
        {openFiles.length ? (
          <div className="space-y-1">
            {openFiles.map((file) => (
              <Button
                key={file.path}
                variant="ghost"
                onClick={() => openWorkspaceFile(file)}
                className="h-9 w-full justify-start text-xs"
              >
                <File className="size-4 text-stone-400" />
                <span className="truncate">{file.name}</span>
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-6 text-stone-400">从左侧工作区选择文件，即可在标签页中打开。</p>
        )}
      </section>
    </div>
  )
}
