import { addTransitFile } from "@/components/transit/state"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Copy, FolderOpen, FilePlus2, FolderPlus, Pencil, Trash2, Pin, File } from "lucide-react"
import { createPortal } from "react-dom"
import { useState, type ReactNode } from "react"
import { PopoverAnchor } from "@radix-ui/react-popover"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import type { WorkspaceNode } from "@/pages/workspace/types/workspace"

/** 普通文件右键菜单，成功后更新标签与目录缓存。删除使用系统废纸篓。 */
export function FileActions({ node, children, onChanged, onCreate }: { node: WorkspaceNode; children: ReactNode; onChanged: () => void; onCreate?: (kind: "file" | "directory") => void }) {
  const { workspace, renameWorkspaceTab, closeWorkspaceFiles, openFiles } = useWorkspace()
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const [confirmRename, setConfirmRename] = useState(false)
  const requestRename = () => {
    if (busy) return
    if (name.trim() + extension === node.name) { setRenaming(false); return }
    if (name.trim()) setConfirmRename(true)
    else setRenaming(false)
  }
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const extension = node.type === "directory" || node.name.lastIndexOf(".") <= 0 ? "" : node.name.slice(node.name.lastIndexOf("."))
  const [name, setName] = useState(node.name.slice(0, node.name.length - extension.length))
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const mutate = async (next?: string) => {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const path = await window.electronAPI.mutateWorkspaceFile(workspace.path, node.path, next)
      const affected = openFiles.filter((file) => file.path === node.path || (node.type === "directory" && file.path.startsWith(node.path + (node.path.includes("\\") ? "\\" : "/"))))
      if (next !== undefined) affected.forEach((file) => renameWorkspaceTab(file.path, path + file.path.slice(node.path.length), file.path === node.path ? next : file.name))
      else closeWorkspaceFiles(affected.map((file) => file.path))
      setRenaming(false)
      setConfirmRename(false)
      setConfirmTrash(false)
      onChanged()
      setPoint(null)
    } catch (reason) {
      setError(String(reason))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
    <Popover
      open={!!point}
      onOpenChange={(open) => {
        if (!open && !busy) setPoint(null)
      }}
    >
      <div
        className="w-full min-w-0"
        onContextMenu={(event) => {
          event.stopPropagation()
          event.preventDefault()
          setPoint({ x: event.clientX, y: event.clientY })
          setRenaming(false)
          setName(node.name.slice(0, node.name.length - extension.length))
          setError("")
        }}
      >
        {renaming ? <form className="flex min-w-0 items-center gap-2 rounded-md bg-stone-50 px-2 py-1" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); requestRename() }}>
          {node.type === "directory" ? <FolderOpen className="size-4 shrink-0 text-amber-600" /> : <File className="size-4 shrink-0 text-violet-500" />}
          <div className="flex min-w-0 flex-1 items-center rounded-md border border-green-600 bg-white px-1.5 py-0.5 shadow-[0_0_0_3px_rgba(22,163,74,0.1)]">
            <input autoFocus onBlur={() => { if (renaming) requestRename() }} aria-label="文件新名称" value={name} disabled={busy} onFocus={event => event.target.select()} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setRenaming(false) } }} className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
            <span className="text-xs text-stone-400">{extension}</span>
          </div>
          {error && <span role="alert" title={error} className="text-xs text-red-500">{error}</span>}
        </form> : children}
      </div>
      {createPortal(
        <PopoverAnchor asChild>
          <span style={{ width: 0, height: 0, position: "fixed", left: point?.x, top: point?.y }} />
        </PopoverAnchor>,
        document.body
      )}
      <PopoverContent
        onCloseAutoFocus={event => event.preventDefault()}
        align="start"
        className={renaming ? "w-52 p-2" : "w-44 p-1"}
      >
        {(          <>
            {node.type === "directory" &&
              (
                [
                  { kind: "file", label: "新建文件", Icon: FilePlus2 },
                  { kind: "directory", label: "新建文件夹", Icon: FolderPlus }
                ] as const
              ).map(({ kind, label, Icon }) => (
                <Button
                  key={kind}
                  variant="ghost"
                  className="h-8 w-full justify-start text-xs hover:text-white"
                  onClick={() => {
                    setPoint(null)
                    onCreate?.(kind)
                  }}
                >
                  <Icon className="!size-3.5" />
                  {label}
                </Button>
              ))}
            {[
              { label: "复制文件名", Icon: Copy, run: () => navigator.clipboard.writeText(node.name) },
              { label: "复制路径", Icon: Copy, run: () => navigator.clipboard.writeText(node.path) },
              { label: "在资源管理器中显示", Icon: FolderOpen, run: () => window.electronAPI.revealWorkspaceFile(workspace.path, node.path) }
            ].map(({ label, Icon, run }) => (
              <Button
                key={label}
                variant="ghost"
                className="h-8 w-full justify-start text-xs hover:text-white"
                onClick={() => {
                  void run()
                    .then(() => setPoint(null))
                    .catch((reason) => setError(String(reason)))
                }}
              >
                <Icon className="!size-3.5" />
                {label}
              </Button>
            ))}
            {node.type !== "directory" && <Button variant="ghost" className="h-8 w-full justify-start text-xs hover:text-white" onClick={() => { try { addTransitFile(workspace.path, node.path, node.name); setPoint(null) } catch (reason) { setError(String(reason)) } }}><Pin className="!size-3.5" />加入中转站</Button>}
            <Button
              variant="ghost"
              disabled={busy}
              className="h-8 w-full justify-start text-xs hover:text-white"
              onClick={() => { setPoint(null); setRenaming(true) }}
            >
              <Pencil className="!size-3.5" />
              重命名
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              className="h-8 w-full justify-start text-xs text-red-600 hover:bg-red-600 hover:text-white"
              onClick={() => { setError(""); setPoint(null); setConfirmTrash(true) }}
            >
              <Trash2 className="!size-3.5" />
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
    <AlertDialog open={confirmRename} onOpenChange={setConfirmRename}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认重命名？</AlertDialogTitle><AlertDialogDescription>将“{node.name}”重命名为“{name.trim() + extension}”？</AlertDialogDescription></AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy} onClick={() => setRenaming(false)}>取消</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); void mutate(name.trim() + extension) }}>确认重命名</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={confirmTrash} onOpenChange={open => { if (!busy) setConfirmTrash(open) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>移到废纸篓？</AlertDialogTitle>
          <AlertDialogDescription className="break-all">
            确定将“{node.name}”{node.type === "directory" ? "及其全部内容" : ""}移到系统废纸篓吗？之后可在废纸篓中恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="break-all text-sm text-red-500">移动失败：{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <AlertDialogAction disabled={busy} className="bg-red-600 text-white hover:bg-red-700" onClick={event => { event.preventDefault(); void mutate() }}>
            {busy ? "正在移动…" : "确认移到废纸篓"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
