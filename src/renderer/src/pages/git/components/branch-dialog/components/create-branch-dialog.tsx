import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GitBranch } from "lucide-react"
import { useEffect, useState } from "react"

/** Renders the create branch dialog component. */
export function CreateBranchDialog({
  open,
  onOpenChange,
  currentBranch,
  branches,
  startPoint: initialStartPoint,
  onCreate
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBranch: string
  branches: string[]
  startPoint?: string
  onCreate: (name: string, startPoint?: string, checkout?: boolean) => void
}) {
  const [name, setName] = useState("")
  const [startPoint, setStartPoint] = useState(initialStartPoint || currentBranch)
  const [checkout, setCheckout] = useState(true)

  useEffect(() => {
    if (open) {
      setStartPoint(initialStartPoint || currentBranch)
      setName("")
    }
  }, [open, initialStartPoint, currentBranch])

  /** Handles confirm events. */
  const handleConfirm = () => {
    if (!name.trim()) return
    onCreate(name.trim(), startPoint, checkout)
    setName("")
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="git-dialog sm:max-w-[420px] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <GitBranch className="size-4 text-green-600" />
            新建分支 (New Branch)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div>
            <label className="mb-1 block font-medium text-stone-600">分支名称</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: feature/login 或 bugfix/typo"
              className="w-full rounded-md border border-stone-200 px-3 py-1.5 text-xs outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm()
              }}
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-stone-600">基于起点 (Start Point)</label>
            <select
              value={startPoint}
              onChange={(e) => setStartPoint(e.target.value)}
              className="w-full rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-green-600"
            >
              <option value={currentBranch}>{currentBranch} (当前分支)</option>
              {startPoint && startPoint !== currentBranch && !branches.includes(startPoint) && <option value={startPoint}>提交起点: {startPoint.slice(0, 7)}</option>}
              {branches
                .filter((b) => b !== currentBranch)
                .map((b) => (
                  <option
                    key={b}
                    value={b}
                  >
                    {b}
                  </option>
                ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-stone-600 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={checkout}
              onChange={(e) => setCheckout(e.target.checked)}
              className="rounded border-stone-300 text-green-600 focus:ring-green-500"
            />
            <span>创建后立即检出切换到该分支 (Checkout new branch)</span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={handleConfirm}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            创建分支
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
