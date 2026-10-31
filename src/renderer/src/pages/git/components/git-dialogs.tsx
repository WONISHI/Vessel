import { RepositorySettingsDialog } from "@/pages/git/components/repository-settings-dialog"
import { TerminalPanel } from "@/components/workspace/components/layout-main/terminal-panel"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/sonner"
import { CreateBranchDialog, MergeBranchDialog } from "@/pages/git/components/branch-dialog"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** 新建分支 / 仓库设置 / 终端 / 合并分支弹窗 */
export function GitDialogs({ g }: { g: GitPageModel }) {
  const { repositorySettingsOpen, setRepositorySettingsOpen, terminalOpen, setTerminalOpen, repoPath, branches, createBranchOpen, setCreateBranchOpen, branchStartPoint, setBranchStartPoint, mergeBranchOpen, setMergeBranchOpen, refresh } = g

  return (
    <>
        {/* 弹窗：新建分支 */}
        <CreateBranchDialog
          open={createBranchOpen}
          onOpenChange={(open) => {
            setCreateBranchOpen(open)
            if (!open) setBranchStartPoint(undefined)
          }}
          currentBranch={branches.current}
          branches={branches.local}
          startPoint={branchStartPoint}
          onCreate={async (name, startPoint, checkout) => {
            try {
              await window.electronAPI.git.createBranch(repoPath, name, startPoint, checkout)
              toast.success(`成功创建分支: ${name}`)
              await refresh()
            } catch (e: any) {
              toast.error("创建分支失败", { description: cleanGitErrorMessage(e) })
            }
          }}
        />

        <RepositorySettingsDialog open={repositorySettingsOpen} repoPath={repoPath} onOpenChange={setRepositorySettingsOpen} onSaved={() => {
          toast.success("仓库设置已保存")
          void refresh()
        }} />
        <Dialog open={terminalOpen} onOpenChange={setTerminalOpen}>
          <DialogContent className="git-dialog flex h-[min(560px,80vh)] max-w-4xl flex-col gap-2 p-4">
            <DialogHeader><DialogTitle className="text-sm">仓库终端</DialogTitle></DialogHeader>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border"><TerminalPanel key={repoPath} root={repoPath} onClose={() => setTerminalOpen(false)} /></div>
          </DialogContent>
        </Dialog>

        {/* 弹窗：合并分支 */}
        <MergeBranchDialog
          open={mergeBranchOpen}
          onOpenChange={setMergeBranchOpen}
          currentBranch={branches.current}
          branches={branches.local}
          onMerge={async (branch) => {
            try {
              const res = await window.electronAPI.git.merge(repoPath, branch)
              if (res.success) {
                toast.success("合并成功")
              } else {
                toast.warning(`合并完成，请检查冲突：${res.output}`)
              }
              await refresh()
            } catch (e: any) {
              toast.error("合并失败", { description: cleanGitErrorMessage(e) })
            }
          }}
        />
    </>
  )
}
