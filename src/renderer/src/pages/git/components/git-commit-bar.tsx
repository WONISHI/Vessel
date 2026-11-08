import { CommitMessageInput } from "@/pages/git/components/commit-message-input"
import { Button } from "@/components/ui/button"
import { Undo2 } from "lucide-react"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** 底部提交输入栏 */
export function GitCommitBar({ g }: { g: GitPageModel }) {
  const { status, branches, commits, commitMessage, commitMessageReset, isAmend, setIsAmend, handleUndoLastCommit, handleCommit } = g

  return (
                  <div className="border-t border-stone-200 p-2.5 bg-white shrink-0">
                    <CommitMessageInput
                      draft={commitMessage}
                      resetVersion={commitMessageReset}
                      onSubmit={() => { if (status?.staged.length) void handleCommit() }}
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-[11px] text-stone-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAmend}
                            onChange={(e) => setIsAmend(e.target.checked)}
                            className="rounded border-stone-300"
                          />
                          <span>修改上次提交</span>
                        </label>
                        {commits.length > 0 && (
                          <button
                            type="button"
                            className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-800 hover:underline"
                            onClick={() => void handleUndoLastCommit("mixed")}
                            data-title="撤销最后一次提交并将修改保留在工作区 (git reset HEAD~1)"
                          >
                            <Undo2 className="size-3" />
                            <span>撤销上次提交</span>
                          </button>
                        )}
                      </div>
                      <Button
                        size="sm"
                        disabled={!status?.staged.length}
                        onClick={handleCommit}
                        className="bg-green-600 text-white hover:bg-green-700 h-7 text-xs px-3"
                      >
                        提交到 {branches.current || "HEAD"}
                      </Button>
                    </div>
                  </div>
  )
}
