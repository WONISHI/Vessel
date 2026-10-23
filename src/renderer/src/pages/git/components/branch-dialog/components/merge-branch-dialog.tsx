import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GitMerge } from "lucide-react"
import { useState } from "react"

/** Renders the merge branch dialog component. */
export function MergeBranchDialog({ open, onOpenChange, currentBranch, branches, onMerge }: { open: boolean; onOpenChange: (open: boolean) => void; currentBranch: string; branches: string[]; onMerge: (branchToMerge: string) => void }) {
  const [selectedBranch, setSelectedBranch] = useState(branches.filter((b) => b !== currentBranch)[0] || "")

  /** Handles confirm events. */
  const handleConfirm = () => {
    if (!selectedBranch) return
    onMerge(selectedBranch)
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
            <GitMerge className="size-4 text-purple-600" />
            合并分支 (Merge Branch)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <p className="text-stone-500">
            将选定分支的所有更改合并到当前检出的分支：
            <span className="font-semibold text-stone-800 ml-1 underline">{currentBranch}</span>
          </p>

          <div>
            <label className="mb-1 block font-medium text-stone-600">要合并的分支</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-green-600"
            >
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
            disabled={!selectedBranch}
            onClick={handleConfirm}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            开始合并
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
