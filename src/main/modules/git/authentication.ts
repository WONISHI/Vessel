import { randomUUID } from "node:crypto"
import { ipcMain, type WebContents } from "electron"
import { readGitCredential, saveGitCredential, eraseGitCredential } from "../../vault/service"
import { createCredentialHandler } from "./credential-handler"
import { withGitAskpass } from "./askpass"

export async function withGitAuthentication<T>(sender: WebContents, action: () => Promise<T>, interactive = true): Promise<T> {
  const pending = new Set<() => void>()
  let rejected = false, warned = false
  const credentials = createCredentialHandler({ read: readGitCredential, save: saveGitCredential, erase: eraseGitCredential }, () => { rejected = true }, () => {
    if (interactive && !warned && !sender.isDestroyed()) sender.send("git:auth-warning", "系统安全存储不可用或保险库已锁定，本次 Git 凭据未能保存或读取")
    warned = true
  })
  try {
    return await withGitAskpass(value => new Promise(resolve => {
      if (!interactive) { resolve(null); return }
      // Only HTTP credentials are requested here; SSH keeps its existing agent flow.
      const match = /^(Username|Password) for ['"]?(https?:\/\/[^'"\s]+)/i.exec(value)
      if (!match || sender.isDestroyed()) { resolve(null); return }
      let host: string
      try { host = new URL(match[2]).origin } catch { resolve(null); return }
      const id = randomUUID(), password = match[1].toLowerCase() === "password"
      const finish = (answer: string | null) => {
        clearTimeout(timer)
        ipcMain.removeListener("git:auth-response", reply)
        sender.removeListener("destroyed", cancel)
        pending.delete(cancel)
        if (!sender.isDestroyed()) sender.send("git:auth-dismiss", id)
        resolve(answer)
      }
      const cancel = () => finish(null)
      const reply = (event: Electron.IpcMainEvent, requestId: unknown, answer: unknown) => {
        if (event.sender.id !== sender.id || requestId !== id) return
        finish(typeof answer === "string" && answer.length <= 4096 && !/[\r\n\0]/.test(answer) ? answer : null)
      }
      const timer = setTimeout(cancel, 300_000)
      pending.add(cancel)
      sender.once("destroyed", cancel)
      ipcMain.on("git:auth-response", reply)
      sender.send("git:auth-request", { id, host, password })
    }), async () => {
      try { return await action() }
      catch (error) {
        if (!rejected) throw error
        rejected = false
        return action()
      }
    }, credentials)
  } finally { pending.forEach(cancel => cancel()) }
}
