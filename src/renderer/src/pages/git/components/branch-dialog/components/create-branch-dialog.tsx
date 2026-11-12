import "@/pages/git/components/create-tag-dialog.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { CheckField } from "@/pages/git/components/git-check-field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GitBranch } from "lucide-react"
import { useEffect, useId, useState } from "react"

/** Renders the create branch dialog component. */
export function CreateBranchDialog({
  open,
  onOpenChange,
  currentBranch,
  branches,
  startPoint: initialStartPoint,
  namePrefix = "",
  onCreate
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBranch: string
  branches: string[]
  startPoint?: string
  /** Prefill branch name, e.g. folder path "codex/". */
  namePrefix?: string
  onCreate: (name: string, startPoint?: string, checkout?: boolean) => void
}) {
  const startPointId = useId()
  const nameId = useId()
  const checkoutId = useId()
  const [name, setName] = useState("")
  const [startPoint, setStartPoint] = useState(initialStartPoint || currentBranch)
  const [checkout, setCheckout] = useState(true)

  useEffect(() => {
    if (open) {
      setStartPoint(initialStartPoint || currentBranch)
      setName(namePrefix || "")
    }
  }, [open, initialStartPoint, currentBranch, namePrefix])

  /** Handles confirm events. */
  const handleConfirm = () => {
    if (!name.trim()) return
    onCreate(name.trim(), startPoint, checkout)
    setName("")
    onOpenChange(false)
  }

  const branchName = name.trim()
  const exists = branches.includes(branchName)
  return (
    <Dialog
      modal={false}
      open={open}
      onOpenChange={onOpenChange}
    >
      {open && <DialogPortal>
        <div aria-hidden="true" className="fixed inset-y-0 right-0 left-[52px] z-50 bg-black/[.04] backdrop-blur-[3px]" />
      </DialogPortal>}
      <DialogContent showCloseButton={false} className="left-[calc(50%+26px)] w-[calc(100%-52px)] git-dialog git-tag-dialog flex max-h-[90vh] max-w-[460px] flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-stone-200/80 px-5 py-3.5 dark:border-stone-700/70">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"><GitBranch className="size-4" /></span>
          <DialogHeader className="min-w-0 space-y-0.5 text-left">
            <DialogTitle className="text-[15px] font-semibold">新建分支</DialogTitle>
            <DialogDescription className="truncate text-xs">基于 {initialStartPoint && !branches.includes(initialStartPoint) && initialStartPoint !== currentBranch ? `提交 ${initialStartPoint.slice(0, 7)}` : startPoint || "当前分支"} 创建新分支</DialogDescription>
          </DialogHeader>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); if (!exists) handleConfirm() }}>
          <div className="grid min-h-0 flex-1 grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 overflow-y-auto px-5 py-4 text-xs">
            <label htmlFor={nameId} className="text-right text-stone-500 dark:text-stone-400">分支名称</label>
            <Input id={nameId} autoFocus autoComplete="off" spellCheck={false} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 feature/login" className="h-8 font-mono text-xs md:text-xs" />
            {exists && <p className="col-start-2 -mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">分支已存在，请换一个名称</p>}

            <label htmlFor={startPointId} className="text-right text-stone-500 dark:text-stone-400">起点</label>
            <Select value={startPoint} onValueChange={(value) => { if (value) setStartPoint(value) }}>
              <SelectTrigger id={startPointId} className="git-tag-field h-8 w-full text-xs">
                <SelectValue placeholder="选择起点" />
              </SelectTrigger>
              <SelectContent>
                {currentBranch && <SelectItem value={currentBranch} className="text-xs">{currentBranch}（当前分支）</SelectItem>}
                {initialStartPoint && initialStartPoint !== currentBranch && !branches.includes(initialStartPoint) && (
                  <SelectItem value={initialStartPoint} className="text-xs">提交 {initialStartPoint.slice(0, 7)}</SelectItem>
                )}
                {branches
                  .filter((branch) => branch && branch !== currentBranch)
                  .map((branch) => (
                    <SelectItem key={branch} value={branch} className="text-xs">{branch}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <span className="text-right text-stone-500 dark:text-stone-400">检出</span>
            <CheckField id={checkoutId} checked={checkout} onChange={setCheckout}>创建后立即切换到该分支</CheckField>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-stone-200/80 px-5 py-3 dark:border-stone-700/70">
            <Button type="button" variant="outline" size="sm" className="git-tag-cancel h-8 text-xs" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" size="sm" className="git-tag-submit h-8 min-w-16 text-xs" disabled={!branchName || exists}>创建分支</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
