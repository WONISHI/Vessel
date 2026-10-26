import { fileEntryOptions } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/create-entry/components/file-entry-options"
import { addTransitFile } from "@/components/transit/state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useWorkspace } from "@/components/workspace/hooks/useWorkspace"
import type { WorkspaceNode } from "@/components/workspace/types/workspace"
import { useRouter } from "@vessel/react-router"
import { localFileURL } from "@vessel/utils"
import { Code, Copy, File, FilePlus2, FolderOpen, FolderPlus, Globe, Send, Pencil, Pin, Search, Trash2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

let copiedFiles: string[] = []

/** 普通文件右键菜单，成功后更新标签与目录缓存。删除使用系统废纸篓。 */
export function FileActions({
  node,
  selectedNodes,
  children,
  onChanged,
  onCreate,
  onSearchDirectory,
  onRenamingChange
}: {
  node: WorkspaceNode
  selectedNodes?: WorkspaceNode[]
  children: ReactNode
  onChanged: () => void
  onCreate?: (kind: "file" | "directory", extension?: string) => void
  onSearchDirectory?: (path: string) => void
  onRenamingChange?: (renaming: boolean) => void
}) {
  const { workspace, renameWorkspaceTab, closeWorkspaceFiles, openFiles, openWorkspaceFile } = useWorkspace()
  const targets = selectedNodes?.some((item) => item.path === node.path) ? selectedNodes : [node]
  const multiple = targets.length > 1
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selectName = useCallback((input: HTMLInputElement) => {
    const extensionStart = input.value.lastIndexOf(".")
    const end = node.type === "file" && extensionStart > 0 ? extensionStart : input.value.length
    input.setSelectionRange(0, end)
  }, [node.type])

  /** Focuses input. */
  const focusInput = useCallback((input: HTMLInputElement | null) => {
    inputRef.current = input
    if (input) {
      input.focus({ preventScroll: true })
      selectName(input)
    }
  }, [selectName])
  const submitting = useRef(false)
  const cancelled = useRef(false)
  const [confirmRename, setConfirmRename] = useState(false)
  const validating = useRef(false)
  const [renaming, setRenamingState] = useState(false)
  useEffect(() => {
    if (!renaming) return
    const el = inputRef.current
    if (el) {
      el.focus({ preventScroll: true })
      selectName(el)
    }
    const raf = requestAnimationFrame(() => {
      const el2 = inputRef.current
      if (el2) {
        el2.focus({ preventScroll: true })
        selectName(el2)
      }
    })
    const timer = setTimeout(() => {
      const el3 = inputRef.current
      if (el3) {
        el3.focus({ preventScroll: true })
        selectName(el3)
      }
    }, 50)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [renaming, selectName])

  /** Sets renaming. */
  const setRenaming = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setRenamingState((prev) => {
        const next = typeof value === "function" ? value(prev) : value
        onRenamingChange?.(next)
        return next
      })
    },
    [onRenamingChange]
  )

  /** Requests rename. */
  const requestRename = async () => {
    if (submitting.current || cancelled.current || validating.current || confirmRename) return
    if (name.trim() === node.name) {
      setRenaming(false)
      return
    }
    if (!name.trim()) {
      setRenaming(false)
      return
    }
    validating.current = true
    try {
      const next = name.trim()
      if (/[\\/\0]/.test(next) || next === "." || next === "..") throw new Error("名称无效")
      const siblings = await window.electronAPI.readWorkspaceDirectory(workspace.path, node.path.replace(/[\\/][^\\/]+$/, ""))
      if (siblings.some((item) => item.path !== node.path && item.name.toLocaleLowerCase() === next.toLocaleLowerCase())) throw new Error("目标名称已存在，请使用其他名称")
      setError("")
      setConfirmRename(true)
    } catch (reason) {
      toast.error("重命名失败", {
        id: `workspace-rename-${node.path}`,
        description: reason instanceof Error ? reason.message : String(reason).replace(/^Error:\s*/, "")
      })
    } finally {
      validating.current = false
    }
  }
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [name, setName] = useState(node.name)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  /** Performs the mutate operation. */
  const mutate = async (next?: string) => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError("")
    try {
      const operations = next !== undefined ? [node] : targets.filter((item) => !targets.some((parent) => parent !== item && parent.type === "directory" && item.path.startsWith(parent.path + (parent.path.includes("\\") ? "\\" : "/"))))
      for (const target of operations) {
        const path = await window.electronAPI.mutateWorkspaceFile(workspace.path, target.path, next)
        const affected = openFiles.filter((file) => file.path === target.path || (target.type === "directory" && file.path.startsWith(target.path + (target.path.includes("\\") ? "\\" : "/"))))
        if (next !== undefined) affected.forEach((file) => renameWorkspaceTab(file.path, path + file.path.slice(target.path.length), file.path === target.path ? next : file.name))
        else closeWorkspaceFiles(affected.map((file) => file.path))
      }
      setRenaming(false)
      setConfirmTrash(false)
      setConfirmRename(false)
      onChanged()
      setMenuOpen(false)
    } catch (reason) {
      setError(String(reason))
    } finally {
      onChanged()
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <>
      <ContextMenu onOpenChange={setMenuOpen}>
        <ContextMenuTrigger asChild>
          <div
            data-file-context-open={menuOpen}
            className={`w-full min-w-0 rounded-md ${menuOpen ? "[&>button]:!bg-[#f0efed]" : ""}`}
            onContextMenu={() => {
              setError("")
              setName(node.name)
            }}
          >
            {renaming ? (
              <form
                draggable={false}
                onDragStart={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                className="flex min-w-0 items-center gap-2 rounded-md bg-stone-50 px-2 py-1"
                onClick={(event) => event.stopPropagation()}
                onSubmit={(event) => {
                  event.preventDefault()
                  requestRename()
                }}
              >
                {node.type === "directory" ? <FolderOpen className="size-4 shrink-0 text-amber-600" /> : <File className="size-4 shrink-0 text-violet-500" />}
                <div className="flex min-w-0 flex-1 items-center rounded-md border border-green-600 bg-white px-1.5 py-0.5 shadow-[0_0_0_3px_rgba(22,163,74,0.1)]">
                  <input
                    autoFocus
                    ref={focusInput}
                    draggable={false}
                    onDragStart={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    onBlur={() => {
                      if (renaming) requestRename()
                    }}
                    aria-label="文件新名称"
                    value={name}
                    disabled={busy}
                    onFocus={(event) => selectName(event.currentTarget)}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault()
                        cancelled.current = true
                        setRenaming(false)
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                  />
                </div>
              </form>
            ) : (
              children
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="workspace-file-context-menu w-48"
        >
          {multiple && <><div className="px-2 py-1.5 text-xs text-muted-foreground">已选中 {targets.length} 项</div><ContextMenuSeparator /></>}
          {!multiple && node.type !== "directory" && /\.(html?|xhtml)$/i.test(node.name) && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <FolderOpen />
                打开方式
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onSelect={() => openWorkspaceFile(node)}>
                  <Code />
                  文本编辑器（默认）
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    sessionStorage.setItem("vessel-browser-pending-url", localFileURL(node.path))
                    window.dispatchEvent(new Event("vessel-browser-open-url"))
                    void router.push("/browser")
                  }}
                >
                  <Globe />
                  解析编辑器
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          {!multiple && node.type === "directory" && (
            <>
              <ContextMenuSub>
                <ContextMenuSubTrigger><FilePlus2 />新建文件</ContextMenuSubTrigger>
                <ContextMenuSubContent className="workspace-file-context-menu w-52">
                  {fileEntryOptions.map(({ extension, label, icon: Icon }) => (
                    <ContextMenuItem key={extension} data-title={label} data-title-side="right" onSelect={() => onCreate?.("file", extension)}>
                      <Icon /><span className="min-w-0 truncate">{label}</span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuItem onSelect={() => onCreate?.("directory")}><FolderPlus />新建文件夹</ContextMenuItem>
            </>
          )}
          {!multiple && node.type === "directory" && onSearchDirectory && (
            <ContextMenuItem onSelect={() => onSearchDirectory(node.path)}>
              <Search />
              在文件夹中搜索
            </ContextMenuItem>
          )}
          <ContextMenuItem
            onSelect={() => {
              copiedFiles = targets.map((item) => item.path)
            }}
          >
            <Copy />
            复制
          </ContextMenuItem>
          {!multiple && copiedFiles.length > 0 && (
            <ContextMenuItem
              disabled={busy}
              onSelect={() => {
                const sources = copiedFiles
                const destination = node.type === "directory" ? node.path : node.path.replace(/[\\/][^\\/]+$/, "")
                setBusy(true)
                void window.electronAPI
                  .transferWorkspaceFiles(workspace.path, sources, destination, true, true)
                  .then(() => {
                    if (copiedFiles === sources) copiedFiles = []
                    onChanged()
                  })
                  .catch((error) => toast.error(String(error)))
                  .finally(() => setBusy(false))
              }}
            >
              <Copy />
              粘贴
            </ContextMenuItem>
          )}
          {[
            {
              label: "复制文件名",
              Icon: Copy,

              /** Runs run. */
              run: () => navigator.clipboard.writeText(targets.map((item) => item.name).join("\n"))
            },
            {
              label: "复制路径",
              Icon: Copy,

              /** Runs run. */
              run: () => navigator.clipboard.writeText(targets.map((item) => item.path).join("\n"))
            },
            {
              label: "在资源管理器中显示",
              Icon: FolderOpen,

              /** Runs run. */
              run: () => window.electronAPI.revealWorkspaceFile(workspace.path, node.path)
            }
          ].filter((item) => !multiple || item.label !== "在资源管理器中显示").map(({ label, Icon, run }) => (
            <ContextMenuItem
              key={label}
              onSelect={() => {
                void run().catch((reason) => setError(String(reason)))
              }}
            >
              <Icon />
              {label}
            </ContextMenuItem>
          ))}
          {!multiple && node.type !== "directory" && (
            <ContextMenuItem
              disabled={busy}
              onSelect={() => {
                setBusy(true)
                void window.electronAPI.shareFilesToWechat(workspace.path, [node.path])
                  .then(({ opened }) => toast.success(opened ? "文件已复制，请在微信中选择联系人后粘贴发送" : "文件已复制，请手动打开微信并粘贴发送"))
                  .catch((reason) => setError(String(reason)))
                  .finally(() => setBusy(false))
              }}
            >
              <Send />发送文件到微信…
            </ContextMenuItem>
          )}
          {targets.every((item) => item.type !== "directory") && (
            <ContextMenuItem
              onSelect={() => {
                try {
                  targets.forEach((item) => addTransitFile(workspace.path, item.path, item.name))
                } catch (reason) {
                  setError(String(reason))
                }
              }}
            >
              <Pin />
              加入中转站
            </ContextMenuItem>
          )}
          {!multiple && <ContextMenuItem
            disabled={busy}
            onSelect={() => {
              cancelled.current = false
              setRenaming(true)
            }}
          >
            <Pencil />
            重命名
          </ContextMenuItem>}
          <ContextMenuItem
            disabled={busy}
            className="text-red-600 data-[highlighted]:bg-red-600"
            onSelect={() => {
              setError("")
              setConfirmTrash(true)
            }}
          >
            <Trash2 />
            移到废纸篓
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <ConfirmDialog
        tone="primary"
        open={confirmRename}
        onOpenChange={(open) => {
          setConfirmRename(open)
          if (!open && !busy) setRenaming(false)
        }}
        title="确认重命名？"
        description={`将“${node.name}”重命名为“${name.trim()}”？`}
        confirmText="确认重命名"
        busy={busy}
        error={error}
        onConfirm={() => void mutate(name.trim())}
      />
      <ConfirmDialog
        open={confirmTrash}
        onOpenChange={setConfirmTrash}
        title="移到废纸篓？"
        description={
          <>
            {multiple ? `确定将选中的 ${targets.length} 项及文件夹内全部内容移到系统废纸篓吗？` : `确定将“${node.name}”${node.type === "directory" ? "及其全部内容" : ""}移到系统废纸篓吗？`}之后可在废纸篓中恢复。
          </>
        }
        confirmText={busy ? "正在移动…" : "确认移到废纸篓"}
        busy={busy}
        error={error ? `移动失败：${error}` : undefined}
        onConfirm={() => void mutate()}
      />
    </>
  )
}
