import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu'
import { addTransitFile } from "@/components/transit/state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Copy, FolderOpen, FilePlus2, FolderPlus, Pencil, Trash2, Pin, File } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import type { WorkspaceNode } from "@/pages/workspace/types/workspace"

/** 普通文件右键菜单，成功后更新标签与目录缓存。删除使用系统废纸篓。 */
export function FileActions({ node, children, onChanged, onCreate }: { node: WorkspaceNode; children: ReactNode; onChanged: () => void; onCreate?: (kind: "file" | "directory") => void }) {
  const { workspace, renameWorkspaceTab, closeWorkspaceFiles, openFiles } = useWorkspace()
  const [menuOpen, setMenuOpen] = useState(false)
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
      setMenuOpen(false)
    } catch (reason) {
      setError(String(reason))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
    <ContextMenu onOpenChange={setMenuOpen}>
      <ContextMenuTrigger asChild><div className={`w-full min-w-0 rounded-md ${menuOpen ? "[&>button]:!bg-[#f0efed]" : ""}`} onContextMenu={() => { setError(''); setName(node.name.slice(0,node.name.length-extension.length)) }}>
        {renaming ? <form className="flex min-w-0 items-center gap-2 rounded-md bg-stone-50 px-2 py-1" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); requestRename() }}>
          {node.type === "directory" ? <FolderOpen className="size-4 shrink-0 text-amber-600" /> : <File className="size-4 shrink-0 text-violet-500" />}
          <div className="flex min-w-0 flex-1 items-center rounded-md border border-green-600 bg-white px-1.5 py-0.5 shadow-[0_0_0_3px_rgba(22,163,74,0.1)]">
            <input autoFocus onBlur={() => { if (renaming) requestRename() }} aria-label="文件新名称" value={name} disabled={busy} onFocus={event => event.target.select()} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setRenaming(false) } }} className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
            <span className="text-xs text-stone-400">{extension}</span>
          </div>
          {error && <span role="alert" title={error} className="text-xs text-red-500">{error}</span>}
        </form> : children}

      </div></ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={event => event.preventDefault()} className="w-48">
        {node.type === 'directory' && ([['file','新建文件',FilePlus2],['directory','新建文件夹',FolderPlus]] as const).map(([kind,label,Icon]) => <ContextMenuItem key={kind} onSelect={() => onCreate?.(kind)}><Icon />{label}</ContextMenuItem>)}
        {[
          {label:'复制文件名',Icon:Copy,run:()=>navigator.clipboard.writeText(node.name)},
          {label:'复制路径',Icon:Copy,run:()=>navigator.clipboard.writeText(node.path)},
          {label:'在资源管理器中显示',Icon:FolderOpen,run:()=>window.electronAPI.revealWorkspaceFile(workspace.path,node.path)}
        ].map(({label,Icon,run}) => <ContextMenuItem key={label} onSelect={() => { void run().catch(reason=>setError(String(reason))) }}><Icon />{label}</ContextMenuItem>)}
        {node.type !== 'directory' && <ContextMenuItem onSelect={() => { try { addTransitFile(workspace.path,node.path,node.name) } catch(reason) {setError(String(reason))} }}><Pin />加入中转站</ContextMenuItem>}
        <ContextMenuItem disabled={busy} onSelect={() => setRenaming(true)}><Pencil />重命名</ContextMenuItem>
        <ContextMenuItem disabled={busy} className="text-red-600 data-[highlighted]:bg-red-600" onSelect={() => {setError('');setConfirmTrash(true)}}><Trash2 />移到废纸篓</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
    <ConfirmDialog
      open={confirmRename}
      onOpenChange={open => { setConfirmRename(open); if (!open) setRenaming(false) }}
      tone="primary"
      title="确认重命名？"
      description={<>将“{node.name}”重命名为“{name.trim() + extension}”？</>}
      confirmText={busy ? "正在重命名…" : "确认重命名"}
      busy={busy}
      error={error}
      onConfirm={() => void mutate(name.trim() + extension)}
    />
    <ConfirmDialog
      open={confirmTrash}
      onOpenChange={setConfirmTrash}
      title="移到废纸篓？"
      description={<>确定将“{node.name}”{node.type === "directory" ? "及其全部内容" : ""}移到系统废纸篓吗？之后可在废纸篓中恢复。</>}
      confirmText={busy ? "正在移动…" : "确认移到废纸篓"}
      busy={busy}
      error={error ? `移动失败：${error}` : undefined}
      onConfirm={() => void mutate()}
    />
    </>
  )
}
