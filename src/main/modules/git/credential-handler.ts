import type { GitVaultContext } from "../../vault/service"
import type { CredentialHandler } from "./askpass"

type Storage = {
  read: (context: GitVaultContext) => Promise<{ username: string; password: string } | undefined>
  save: (context: GitVaultContext) => Promise<void>
  erase: (context: GitVaultContext) => Promise<void>
}
function parse(input: string): GitVaultContext | undefined {
  const fields = new Map(input.split("\n").filter(Boolean).map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)] }))
  if (!['http', 'https'].includes(fields.get("protocol") ?? "")) return
  const host = fields.get("host")
  if (!host || /[\r\n\0/@?#]/.test(host)) return
  const url = new URL(`${fields.get("protocol")}://${host}`)
  const username = fields.get("username"), password = fields.get("password"), path = fields.get("path")
  if ([username, password, path].some(value => value !== undefined && (value.length > 4096 || /[\r\n\0]/.test(value)))) return
  return { origin: url.origin, username, password, path }
}
/** Save/erase only when Git reports approve/reject, not when the user merely types a secret. */
export function createCredentialHandler(storage: Storage, rejected: () => void, warning: () => void): CredentialHandler {
  return async (operation, input) => {
    try {
      const context = parse(input)
      if (!context) return ""
      if (operation === "get") {
        const value = await storage.read(context)
        if (!value || /[\r\n\0]/.test(value.username + value.password)) return ""
        return `username=${value.username}\npassword=${value.password}\n\n`
      }
      if (operation === "store" && context.username && context.password) await storage.save(context)
      if (operation === "erase") { rejected(); await storage.erase(context) }
    } catch { warning() }
    return ""
  }
}
