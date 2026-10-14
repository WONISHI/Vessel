import { ipcMain } from "electron"
import { BaseModule } from "../base"
import { gitService } from "./git-service"

export class GitModule extends BaseModule {
  private channels: string[] = []

  protected onActivate(): void {
    const handlers: Record<string, (_event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>> = {
      "git:is-repo": (_e, cwd: string) => gitService.isRepo(cwd),
      "git:init": (_e, cwd: string) => gitService.init(cwd),
      "git:status": (_e, cwd: string) => gitService.getStatus(cwd),
      "git:branches": (_e, cwd: string) => gitService.getBranches(cwd),
      "git:log": (_e, cwd: string, maxCount?: number) => gitService.getLog(cwd, maxCount),
      "git:commit-detail": (_e, cwd: string, hash: string) => gitService.getCommitDetail(cwd, hash),
      "git:diff": (_e, cwd: string, filePath: string, staged?: boolean, commitHash?: string) =>
        gitService.getDiff(cwd, filePath, staged, commitHash),
      "git:stage": (_e, cwd: string, files: string[]) => gitService.stage(cwd, files),
      "git:unstage": (_e, cwd: string, files: string[]) => gitService.unstage(cwd, files),
      "git:stage-all": (_e, cwd: string) => gitService.stageAll(cwd),
      "git:unstage-all": (_e, cwd: string) => gitService.unstageAll(cwd),
      "git:discard": (_e, cwd: string, files: string[], isUntracked?: boolean) =>
        gitService.discard(cwd, files, isUntracked),
      "git:commit": (_e, cwd: string, message: string, amend?: boolean) =>
        gitService.commit(cwd, message, amend),
      "git:checkout": (_e, cwd: string, branch: string) => gitService.checkout(cwd, branch),
      "git:create-branch": (_e, cwd: string, name: string, startPoint?: string, checkout?: boolean) =>
        gitService.createBranch(cwd, name, startPoint, checkout),
      "git:delete-branch": (_e, cwd: string, name: string, force?: boolean) =>
        gitService.deleteBranch(cwd, name, force),
      "git:fetch": (_e, cwd: string, remote?: string) => gitService.fetch(cwd, remote),
      "git:pull": (_e, cwd: string, remote?: string, branch?: string) =>
        gitService.pull(cwd, remote, branch),
      "git:push": (_e, cwd: string, remote?: string, branch?: string, force?: boolean) =>
        gitService.push(cwd, remote, branch, force),
      "git:merge": (_e, cwd: string, branch: string) => gitService.merge(cwd, branch),
      "git:stashes": (_e, cwd: string) => gitService.getStashes(cwd),
      "git:stash-save": (_e, cwd: string, message?: string, files?: string[]) =>
        gitService.stashSave(cwd, message, files),
      "git:stash-pop": (_e, cwd: string, index?: number) => gitService.stashPop(cwd, index),
      "git:stash-drop": (_e, cwd: string, index?: number) => gitService.stashDrop(cwd, index),
      "git:reset": (_e, cwd: string, target: string, mode?: "soft" | "mixed" | "hard") =>
        gitService.reset(cwd, target, mode),
      "git:revert": (_e, cwd: string, hash: string) => gitService.revert(cwd, hash),
      "git:create-tag": (_e, cwd: string, tag: string, target?: string) =>
        gitService.createTag(cwd, tag, target)
    }

    for (const [channel, handler] of Object.entries(handlers)) {
      ipcMain.handle(channel, handler)
      this.channels.push(channel)
    }
  }

  protected onDispose(): void {
    for (const channel of this.channels) {
      ipcMain.removeHandler(channel)
    }
    this.channels = []
  }
}
