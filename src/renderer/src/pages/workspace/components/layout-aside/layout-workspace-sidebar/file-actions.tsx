import { createPortal } from "react-dom"
import { useState, type ReactNode } from "react"
import { PopoverAnchor } from "@radix-ui/react-popover"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import type { WorkspaceNode } from "@/pages/workspace/types/workspace"

/** 普通文件右键菜单，成功后更新标签与目录缓存。删除使用系统废纸篓。 */
export function FileActions({ node, children, onChanged }: { node: WorkspaceNode; children: ReactNode; onChanged: () => void }) {
  const { workspace, renameWorkspaceTab, closeWorkspaceFile } = useWorkspace()
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(node.name)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const mutate = async (next?: string) => {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const path = await window.electronAPI.mutateWorkspaceFile(workspace.path, node.path, next)
      if (next !== undefined) renameWorkspaceTab(node.path, path, next)
      else closeWorkspaceFile(node.path)
      onChanged()
      setPoint(null)
    } catch (reason) {
      setError(String(reason))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Popover
      open={!!point}
      onOpenChange={(open) => {
        if (!open && !busy) setPoint(null)
      }}
    >
      <div
        className="w-full min-w-0"
        onContextMenu={(event) => {
          if (node.type === "directory") return
          event.preventDefault()
          setPoint({ x: event.clientX, y: event.clientY })
          setRenaming(false)
          setName(node.name)
          setError("")
        }}
      >
        {children}
      </div>
      {createPortal(
        <PopoverAnchor asChild>
          <span style={{ width: 0, height: 0, position: "fixed", left: point?.x, top: point?.y }} />
        </PopoverAnchor>,
        document.body
      )}
      <PopoverContent
        align="start"
        className={renaming ? "w-52 p-2" : "w-36 p-1"}
      >
        {renaming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (name.trim()) void mutate(name.trim())
            }}
            className="space-y-2"
          >
            <Input
              autoFocus
              aria-label="文件新名称"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              className="h-7 text-xs"
            />
            <Button
              type="submit"
              disabled={busy || !name.trim()}
              className="h-7 w-full text-xs"
            >
              保存名称
            </Button>
          </form>
        ) : (
          <>
            <Button
              variant="ghost"
              disabled={busy}
              className="h-8 w-full justify-start text-xs hover:text-white"
              onClick={() => setRenaming(true)}
            >
              重命名
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              className="h-8 w-full justify-start text-xs text-red-600 hover:bg-red-600 hover:text-white"
              onClick={() => void mutate()}
            >
              移到废纸篓
            </Button>
          </>
        )}
        {error && (
          <p
            role="alert"
            className="break-all text-xs text-red-500"
          >
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
