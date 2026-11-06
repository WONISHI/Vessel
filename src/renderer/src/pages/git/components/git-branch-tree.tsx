import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronRight, Copy, Folder, GitBranch, GitMerge, History, Layers, Plus, RefreshCw, Trash2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { ancestorKeysForBranch, buildBranchTree, type BranchTreeNode } from "@/pages/git/branch-tree"

/** True when a remote ref tracks the checked-out local branch. */
function isRemoteTrackingCurrent(fullName: string, currentBranch?: string): boolean {
  if (!currentBranch) return false
  if (fullName === currentBranch) return true
  return fullName.endsWith(`/${currentBranch}`)
}

/** Splits origin/feature/foo → { remote: origin, branch: feature/foo }. */
function splitRemoteRef(fullName: string): { remote: string; branch: string } | null {
  const idx = fullName.indexOf("/")
  if (idx <= 0) return null
  const remote = fullName.slice(0, idx)
  const branch = fullName.slice(idx + 1)
  if (!remote || !branch) return null
  return { remote, branch }
}

export type GitBranchTreeActions = {
  onSelectBranch?: (branch: string) => void
  onRequestCheckout: (branch: string) => void
  onCreateBranchFrom?: (startPoint: string, namePrefix?: string) => void
  onMergeIntoCurrent?: (branch: string) => void
  onDeleteBranch?: (branch: string) => void
  onCopyName?: (name: string) => void
  onFetchRemote?: (remote: string) => void
  onPullRemoteBranch?: (remote: string, branch: string) => void
  onPushToRemote?: (remote: string) => void
}

/** Git 侧栏分支 / 远程树：单击展开或选中，双击叶子弹出切换确认，右键菜单 */
export function GitBranchTree({
  names,
  currentBranch,
  autoExpandBranch,
  variant,
  aheadCount = 0,
  behindCount = 0,
  onSelectBranch,
  onRequestCheckout,
  onCreateBranchFrom,
  onMergeIntoCurrent,
  onDeleteBranch,
  onCopyName,
  onFetchRemote,
  onPullRemoteBranch,
  onPushToRemote
}: {
  names: string[]
  /** 当前已检出的本地分支，用于高亮 */
  currentBranch?: string
  /** 需要默认展开到的分支名（通常是当前分支，远程则传对应 remote ref） */
  autoExpandBranch?: string
  variant: "local" | "remote"
  aheadCount?: number
  behindCount?: number
  /** Single-click leaf: select tip in history (not checkout). */
  onSelectBranch?: (branch: string) => void
  onRequestCheckout: (branch: string) => void
  onCreateBranchFrom?: (startPoint: string, namePrefix?: string) => void
  onMergeIntoCurrent?: (branch: string) => void
  onDeleteBranch?: (branch: string) => void
  onCopyName?: (name: string) => void
  onFetchRemote?: (remote: string) => void
  onPullRemoteBranch?: (remote: string, branch: string) => void
  onPushToRemote?: (remote: string) => void
}) {
  const tree = useMemo(() => buildBranchTree(names), [names])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!autoExpandBranch) return
    const keys = ancestorKeysForBranch(autoExpandBranch)
    if (keys.length === 0) return
    setExpanded((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const key of keys) {
        if (!next.has(key)) {
          next.add(key)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [autoExpandBranch])

  /** Toggles folder. */
  const toggleFolder = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /** Local / remote leaf context menu. */
  const renderLeafMenu = (fullName: string, isCurrentLocal: boolean) => {
    const remoteParts = variant === "remote" ? splitRemoteRef(fullName) : null
    return (
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          disabled={isCurrentLocal}
          onSelect={() => onRequestCheckout(fullName)}
        >
          <GitBranch className="size-3.5 text-green-600" />
          <span>{variant === "remote" ? "检出此远程分支…" : "切换到此分支…"}</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onSelectBranch?.(fullName)}>
          <History className="size-3.5 text-stone-500" />
          <span>在历史中显示</span>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onCreateBranchFrom?.(fullName)}
        >
          <Plus className="size-3.5 text-indigo-500" />
          <span>{variant === "remote" ? "从此处创建本地分支…" : "从此处创建分支…"}</span>
        </ContextMenuItem>
        {!isCurrentLocal && (
          <ContextMenuItem onSelect={() => onMergeIntoCurrent?.(fullName)}>
            <GitMerge className="size-3.5 text-purple-500" />
            <span>合并到当前分支…</span>
          </ContextMenuItem>
        )}
        {variant === "remote" && remoteParts && (
          <ContextMenuItem onSelect={() => onPullRemoteBranch?.(remoteParts.remote, remoteParts.branch)}>
            <ArrowDownToLine className="size-3.5 text-blue-500" />
            <span>拉取此远程分支…</span>
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onCopyName?.(fullName)}>
          <Copy className="size-3.5 text-stone-500" />
          <span>复制分支名</span>
        </ContextMenuItem>
        {variant === "local" && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={isCurrentLocal}
              className="text-red-600 focus:text-red-600 data-[highlighted]:bg-red-600"
              onSelect={() => onDeleteBranch?.(fullName)}
            >
              <Trash2 className="size-3.5 text-red-500" />
              <span>删除分支…</span>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    )
  }

  /** Folder context menu (remote root = fetch/push/pull). */
  const renderFolderMenu = (node: BranchTreeNode, depth: number) => {
    const isRemoteRoot = variant === "remote" && depth === 0
    return (
      <ContextMenuContent className="w-56">
        {isRemoteRoot && (
          <>
            <ContextMenuItem onSelect={() => onFetchRemote?.(node.label)}>
              <RefreshCw className="size-3.5 text-sky-500" />
              <span>抓取此远程…</span>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onPullRemoteBranch?.(node.label, "")}>
              <ArrowDownToLine className="size-3.5 text-blue-500" />
              <span>拉取此远程…</span>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onPushToRemote?.(node.label)}>
              <ArrowUpFromLine className="size-3.5 text-orange-500" />
              <span>推送到此远程…</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          onSelect={() => {
            const folderPrefix =
              variant === "remote"
                ? node.key.includes("/")
                  ? `${node.key.slice(node.key.indexOf("/") + 1)}/`
                  : ""
                : node.key.endsWith("/")
                  ? node.key
                  : `${node.key}/`
            onCreateBranchFrom?.(currentBranch || "", folderPrefix || undefined)
          }}
        >
          <Plus className="size-3.5 text-indigo-500" />
          <span>新建分支…</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onCopyName?.(node.key)}>
          <Copy className="size-3.5 text-stone-500" />
          <span>复制名称</span>
        </ContextMenuItem>
      </ContextMenuContent>
    )
  }

  /** Renders a checkout-able leaf row. */
  const renderLeaf = (node: BranchTreeNode, depth: number): ReactNode => {
    if (!node.fullName) return null
    const isCurrentLocal = variant === "local" && Boolean(currentBranch && node.fullName === currentBranch)
    const isCurrentRemote = variant === "remote" && isRemoteTrackingCurrent(node.fullName, currentBranch)
    const isCurrent = isCurrentLocal || isCurrentRemote
    const isSelected = selected === node.fullName
    const pad = 10 + depth * 20
    const LeafIcon = variant === "remote" ? Layers : GitBranch
    const fullName = node.fullName

    return (
      <ContextMenu key={`leaf:${fullName}`}>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            data-git-branch-row="leaf"
            data-git-current={isCurrent ? "true" : "false"}
            data-git-selected={isSelected && !isCurrent ? "true" : "false"}
            data-git-sidebar-hover={isCurrent || isSelected ? undefined : true}
            onClick={() => {
              setSelected(fullName)
              onSelectBranch?.(fullName)
            }}
            onContextMenu={() => setSelected(fullName)}
            onDoubleClick={() => {
              if (isCurrentLocal) return
              onRequestCheckout(fullName)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                if (isCurrentLocal) return
                onRequestCheckout(fullName)
              }
            }}
            className={`flex cursor-pointer items-center justify-between rounded-md py-1.5 pr-2.5 transition-colors ${
              isCurrent
                ? "font-bold text-stone-900"
                : isSelected
                  ? "bg-stone-200/80 font-medium text-stone-800"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-800"
            }`}
            style={{ paddingLeft: pad }}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
              <LeafIcon className={`size-3.5 shrink-0 ${isCurrent ? "text-stone-900" : isSelected ? "text-stone-500" : "text-stone-400"}`} />
              <span className={`min-w-0 flex-1 truncate text-[12px] ${isCurrent ? "font-bold" : ""}`}>{node.label}</span>
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {isCurrentLocal && aheadCount > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1 py-0.2 text-[9px] font-bold text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
                  data-title={`${aheadCount} 次提交待推送`}
                >
                  <ArrowUp className="size-2 stroke-[2.5]" />
                  <span>{aheadCount}</span>
                </span>
              )}
              {isCurrentLocal && behindCount > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1 py-0.2 text-[9px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                  data-title={`远程有 ${behindCount} 次提交待拉取`}
                >
                  <ArrowDown className="size-2 stroke-[2.5]" />
                  <span>{behindCount}</span>
                </span>
              )}
              {isCurrent && <CheckCircle2 className="size-3.5 text-stone-900 dark:text-white" />}
            </div>
          </div>
        </ContextMenuTrigger>
        {renderLeafMenu(fullName, isCurrentLocal)}
      </ContextMenu>
    )
  }

  /** Renders node. */
  const renderNode = (node: BranchTreeNode, depth: number): ReactNode => {
    const hasChildren = node.children.length > 0
    const pad = 10 + depth * 20

    if (!hasChildren) {
      return renderLeaf(node, depth)
    }

    const isOpen = expanded.has(node.key)

    return (
      <div key={node.key}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              data-git-branch-row="folder"
              data-git-selected={selected === node.key ? "true" : "false"}
              data-git-sidebar-hover={selected === node.key ? undefined : true}
              onClick={() => toggleFolder(node.key)}
              onContextMenu={() => setSelected(node.key)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  toggleFolder(node.key)
                }
              }}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 transition-colors ${
                selected === node.key
                  ? "bg-stone-200/80 font-medium text-stone-800"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800/60"
              }`}
              style={{ paddingLeft: pad }}
            >
              {isOpen ? <ChevronDown className="size-3.5 shrink-0 text-stone-400" /> : <ChevronRight className="size-3.5 shrink-0 text-stone-400" />}
              <Folder className="size-3.5 shrink-0 text-amber-500/80" />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{node.label}</span>
            </div>
          </ContextMenuTrigger>
          {renderFolderMenu(node, depth)}
        </ContextMenu>
        {isOpen && (
          <>
            {node.children.map((child) => renderNode(child, depth + 1))}
            {/* 同名既是目录又是分支时，叶子放在子节点最下面 */}
            {node.fullName && renderLeaf({ ...node, children: [] }, depth + 1)}
          </>
        )}
      </div>
    )
  }

  if (tree.length === 0) {
    return <div className="px-2 py-1 text-[11px] italic text-stone-400">暂无分支</div>
  }

  return <div className="flex flex-col">{tree.map((node) => renderNode(node, 0))}</div>
}
