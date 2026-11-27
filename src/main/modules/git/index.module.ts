import type { GitFetchOptions, GitPullOptions } from "@vessel/type/git"
import { searchGitCommits } from "./search"
import { getGitDecorations } from "./git-decorations"
import type { GitPushSelection, GitSearchOptions, GitTagOptions } from "@vessel/type/git"
import { getRepositorySettings, saveRepositorySettings } from "@main/modules/git/repository-settings"
import type { GitRepositorySettings } from "@vessel/type/git"
import { BaseModule } from "@main/modules/base/index"
import { gitService } from "@main/modules/git/git-service"
import { withGitAuthentication } from "./authentication"
import { app, ipcMain } from "electron"
import { join } from "node:path"
import { checkStashContent } from "./stash-content-check"

export class GitModule extends BaseModule {
  private channels: string[] = []

  /** Handles activate events. */
  protected onActivate(): void {
    gitService.configureStashRestoreHistory(join(app.getPath("userData"), "git-stash-restores.json"))
    const handlers: Record<string, (_event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>> = {
      /** Performs the "git:is repo" operation. */
      "git:repository-settings": (_e, cwd: string) => getRepositorySettings(cwd),
      "git:save-repository-settings": (_e, cwd: string, settings: GitRepositorySettings) => saveRepositorySettings(cwd, settings),
      "git:is-repo": (_e, cwd: string) => gitService.isRepo(cwd),
      "git:decorations": (_e, cwd: string) => getGitDecorations(cwd),

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
      "git:fetch": (_e, cwd: string, remote?: string, options?: GitFetchOptions) => gitService.fetch(cwd, remote, options),

      /** Performs the "git:pull" operation. */
      "git:pull": (_e, cwd: string, remote?: string, branch?: string, options?: GitPullOptions) => gitService.pull(cwd, remote, branch, options),

      /** Performs the "git:push" operation. */
      "git:push": (_e, cwd: string, remote?: string, branch?: string, force?: boolean) => gitService.push(cwd, remote, branch, force),
      "git:push-info": (_e, cwd: string) => gitService.getPushInfo(cwd),
      "git:push-selection": (event, cwd: string, selection: GitPushSelection, operationId?: string) => gitService.pushSelection(cwd, selection, operationId ? `${event.sender.id}:${operationId}` : undefined),
      "git:cancel-push": (event, cwd: string, operationId: string) => gitService.cancelPush(cwd, `${event.sender.id}:${operationId}`),

      /** Performs the "git:merge" operation. */
      "git:merge": (_e, cwd: string, branch: string) => gitService.merge(cwd, branch),

      /** Performs the "git:stashes" operation. */
      "git:stashes": (_e, cwd: string) => gitService.getStashes(cwd),

      /** Performs the "git:stash save" operation. */
      "git:stash-save": (_e, cwd: string, message?: string, files?: string[], options?: { keepIndex?: boolean }) => gitService.stashSave(cwd, message, files, options),

      /** Performs the "git:stash pop" operation. */
      "git:stash-pop": (_e, cwd: string, index?: number, expectedHash?: string) => gitService.stashPop(cwd, index, expectedHash),

      "git:stash-apply": (_e, cwd: string, index?: number, expectedHash?: string) => gitService.stashApply(cwd, index, expectedHash),
      "git:stash-restore-history": (_e, cwd: string) => gitService.getStashRestoreHistory(cwd),
      "git:stash-content-check": (_e, cwd: string, hash: string) => checkStashContent(cwd, hash),
      "git:stash-detail": (_e, cwd: string, reference: number | string) => gitService.getStashDetail(cwd, reference),
      "git:stash-diff": (_e, cwd: string, hash: string, filePath: string) => gitService.getStashDiff(cwd, hash, filePath),

      /** Performs the "git:stash drop" operation. */
      "git:stash-drop": (_e, cwd: string, index?: number) => gitService.stashDrop(cwd, index),

      /** Performs the "git:reset" operation. */
      "git:reset": (_e, cwd: string, target: string, mode?: "soft" | "mixed" | "hard") => gitService.reset(cwd, target, mode),

      /** Performs the "git:revert" operation. */
      "git:revert": (_e, cwd: string, hash: string) => gitService.revert(cwd, hash),

      /** Performs the "git:create tag" operation. */
      "git:create-tag": (_e, cwd: string, tag: string, target?: string, options?: GitTagOptions) => gitService.createTag(cwd, tag, target, options),
      "git:search": (_e, cwd: string, options: GitSearchOptions) => searchGitCommits(cwd, options),
      "git:tags": (_e, cwd: string) => gitService.getTags(cwd),
      "git:delete-tag": (_e, cwd: string, tag: string) => gitService.deleteTag(cwd, tag),
      "git:push-tag": (_e, cwd: string, remote: string, tag: string) => gitService.pushTag(cwd, remote, tag),
      "git:delete-remote-tag": (_e, cwd: string, remote: string, tag: string) => gitService.deleteRemoteTag(cwd, remote, tag),

      /** Performs the "git:remote url" operation. */
      "git:remote-web-url": (_e, cwd: string) => gitService.getRemoteWebUrl(cwd),
      "git:remote-url": (_e, cwd: string, remote?: string) => gitService.getRemoteUrl(cwd, remote),

      /** Performs the "git:remote commit url" operation. */
      "git:remote-commit-url": (_e, cwd: string, hash: string, remote?: string) => gitService.getRemoteCommitUrl(cwd, hash, remote),

      /** Performs the "git:unpushed commits" operation. */
      "git:unpushed-commits": (_e, cwd: string) => gitService.getUnpushedCommits(cwd)
    }

    for (const [channel, handler] of Object.entries(handlers)) {
      const remote = new Set(["git:fetch", "git:pull", "git:push", "git:push-selection", "git:push-tag", "git:delete-remote-tag"])
      ipcMain.handle(channel, remote.has(channel) ? (event, ...args) => withGitAuthentication(event.sender, () => handler(event, ...args), !(channel === "git:fetch" && (args[2] as GitFetchOptions | undefined)?.background)) : handler)
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
