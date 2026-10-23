import { BaseModule } from "@main/modules/base/index"
import { gitService } from "@main/modules/git/git-service"
import { ipcMain } from "electron"

export class GitModule extends BaseModule {
  private channels: string[] = []

  /** Handles activate events. */
  protected onActivate(): void {
    const handlers: Record<string, (_event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>> = {
      /** Performs the "git:is repo" operation. */
      "git:is-repo": (_e, cwd: string) => gitService.isRepo(cwd),

      /** Performs the "git:init" operation. */
      "git:init": (_e, cwd: string) => gitService.init(cwd),

      /** Performs the "git:status" operation. */
      "git:status": (_e, cwd: string) => gitService.getStatus(cwd),

      /** Performs the "git:branches" operation. */
      "git:branches": (_e, cwd: string) => gitService.getBranches(cwd),

      /** Performs the "git:log" operation. */
      "git:log": (_e, cwd: string, maxCount?: number, skip?: number, allBranches?: boolean) => gitService.getLog(cwd, maxCount, skip, allBranches),
      /** Counts repository history commits. */
      "git:log-count": (_e, cwd: string, allBranches?: boolean) => gitService.getLogCount(cwd, allBranches),
      /** Counts commits in remote branches. */
      "git:remote-log-count": (_e, cwd: string, allBranches?: boolean, upstream?: string) => gitService.getRemoteLogCount(cwd, allBranches, upstream),

      /** Performs the "git:commit detail" operation. */
      "git:commit-detail": (_e, cwd: string, hash: string) => gitService.getCommitDetail(cwd, hash),

      /** Performs the "git:diff" operation. */
      "git:diff": (_e, cwd: string, filePath: string, staged?: boolean, commitHash?: string) => gitService.getDiff(cwd, filePath, staged, commitHash),

      /** Performs the "git:stage" operation. */
      "git:stage": (_e, cwd: string, files: string[]) => gitService.stage(cwd, files),

      /** Performs the "git:unstage" operation. */
      "git:unstage": (_e, cwd: string, files: string[]) => gitService.unstage(cwd, files),

      /** Performs the "git:stage all" operation. */
      "git:stage-all": (_e, cwd: string) => gitService.stageAll(cwd),

      /** Performs the "git:unstage all" operation. */
      "git:unstage-all": (_e, cwd: string) => gitService.unstageAll(cwd),

      /** Performs the "git:discard" operation. */
      "git:discard": (_e, cwd: string, files: string[], isUntracked?: boolean) => gitService.discard(cwd, files, isUntracked),

      /** Performs the "git:commit" operation. */
      "git:commit": (_e, cwd: string, message: string, amend?: boolean) => gitService.commit(cwd, message, amend),

      /** Performs the "git:checkout" operation. */
      "git:checkout": (_e, cwd: string, branch: string) => gitService.checkout(cwd, branch),

      /** Performs the "git:create branch" operation. */
      "git:create-branch": (_e, cwd: string, name: string, startPoint?: string, checkout?: boolean) => gitService.createBranch(cwd, name, startPoint, checkout),

      /** Performs the "git:delete branch" operation. */
      "git:delete-branch": (_e, cwd: string, name: string, force?: boolean) => gitService.deleteBranch(cwd, name, force),

      /** Performs the "git:fetch" operation. */
      "git:fetch": (_e, cwd: string, remote?: string) => gitService.fetch(cwd, remote),

      /** Performs the "git:pull" operation. */
      "git:pull": (_e, cwd: string, remote?: string, branch?: string) => gitService.pull(cwd, remote, branch),

      /** Performs the "git:push" operation. */
      "git:push": (_e, cwd: string, remote?: string, branch?: string, force?: boolean) => gitService.push(cwd, remote, branch, force),

      /** Performs the "git:merge" operation. */
      "git:merge": (_e, cwd: string, branch: string) => gitService.merge(cwd, branch),

      /** Performs the "git:stashes" operation. */
      "git:stashes": (_e, cwd: string) => gitService.getStashes(cwd),

      /** Performs the "git:stash save" operation. */
      "git:stash-save": (_e, cwd: string, message?: string, files?: string[]) => gitService.stashSave(cwd, message, files),

      /** Performs the "git:stash pop" operation. */
      "git:stash-pop": (_e, cwd: string, index?: number) => gitService.stashPop(cwd, index),

      /** Performs the "git:stash drop" operation. */
      "git:stash-drop": (_e, cwd: string, index?: number) => gitService.stashDrop(cwd, index),

      /** Performs the "git:reset" operation. */
      "git:reset": (_e, cwd: string, target: string, mode?: "soft" | "mixed" | "hard") => gitService.reset(cwd, target, mode),

      /** Performs the "git:revert" operation. */
      "git:revert": (_e, cwd: string, hash: string) => gitService.revert(cwd, hash),

      /** Performs the "git:create tag" operation. */
      "git:create-tag": (_e, cwd: string, tag: string, target?: string) => gitService.createTag(cwd, tag, target),

      /** Performs the "git:remote url" operation. */
      "git:remote-web-url": (_e, cwd: string) => gitService.getRemoteWebUrl(cwd),
      "git:remote-url": (_e, cwd: string, remote?: string) => gitService.getRemoteUrl(cwd, remote),

      /** Performs the "git:remote commit url" operation. */
      "git:remote-commit-url": (_e, cwd: string, hash: string, remote?: string) => gitService.getRemoteCommitUrl(cwd, hash, remote),

      /** Performs the "git:unpushed commits" operation. */
      "git:unpushed-commits": (_e, cwd: string) => gitService.getUnpushedCommits(cwd)
    }

    for (const [channel, handler] of Object.entries(handlers)) {
      ipcMain.handle(channel, handler)
      this.channels.push(channel)
    }
  }

  /** Handles dispose events. */
  protected onDispose(): void {
    for (const channel of this.channels) {
      ipcMain.removeHandler(channel)
    }
    this.channels = []
  }
}
