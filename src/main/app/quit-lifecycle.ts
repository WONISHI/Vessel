import { drainDataOperations } from "../database/data-domain"
import { drainVaultTasks } from "../vault/service"
import { cancelPendingLocalDatabaseDeletion } from "../database/reset-local"
import { app, dialog } from "electron"
import { mainApps } from "@main/app/index"
import { drainTextFileWrites } from "@main/modules/files/index.module"
import { drainWorkspaceSessionWrites } from "@main/modules/welcome/workspace-sessions"
import { closeAllTerminals, resumeTerminalStarts } from "@main/terminal/terminal"

/** Keep IPC and databases available until all windows have accepted closing. */
export function registerQuitLifecycle(): void {
  let drainingTextWrites = false
  let skipWriteDrain = false
  app.on("before-quit", (event) => {
    closeAllTerminals()
    if (skipWriteDrain) return
    if (drainingTextWrites) {
      event.preventDefault()
      return
    }
    const writes = [drainTextFileWrites(), drainWorkspaceSessionWrites(), drainDataOperations(), drainVaultTasks()].filter((value): value is Promise<void> => value != null)
    const pending = writes.length ? Promise.all(writes) : null
    if (!pending) return
    event.preventDefault()
    drainingTextWrites = true
    void (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const completed = pending.then(() => true)
        for (;;) {
          const saved = await Promise.race([completed, new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), 10000) })])
          clearTimeout(timer)
          if (saved) break
          const { response } = await dialog.showMessageBox({
            type: "warning", title: "仍在保存数据", message: "数据保存耗时较长，是否继续等待？",
            detail: "直接退出可能丢失尚未保存的修改。", buttons: ["继续等待", "退出应用"], defaultId: 0, cancelId: 0, noLink: true
          })
          if (response === 1) { skipWriteDrain = true; break }
        }
        drainingTextWrites = false
        app.quit()
      } catch (error) {
        cancelPendingLocalDatabaseDeletion()
        console.error("退出时等待数据保存失败", error)
        resumeTerminalStarts()
        drainingTextWrites = false
        dialog.showErrorBox("暂时无法退出", "等待数据保存时发生错误，请检查保存状态后再次退出。")
      } finally { clearTimeout(timer) }
    })()
  })

  app.on("will-quit", () => {
    closeAllTerminals()
    mainApps.dispose()
  })
}
