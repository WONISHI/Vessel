import { app, session } from "electron"
import { randomUUID } from "node:crypto"
import { extensionProxyConfig } from "./extension-proxy-config"

const permissions = new Map<string, { key: string; allowed: () => boolean }>()
let owner = "", value: unknown = { mode: "system" }, queue = Promise.resolve()
const pending = new Map<string, { token: string; details: object; finish: (credentials?: { username: string; password: string }) => void }>()
let listening = false
const browser = () => session.fromPartition("persist:vessel-browser")

export function registerExtensionProxy(token: string, key: string, allowed: () => boolean) {
  permissions.set(token, { key, allowed })
  if (listening) return
  listening = true
  app.on("login", (event, contents, details, auth, callback) => {
    if (!auth.isProxy || contents?.session !== browser() || !permissions.get(owner)?.allowed()) return
    event.preventDefault()
    const id = randomUUID(), token = owner
    const timer = setTimeout(() => finish(), 10000)
    const finish = (credentials?: { username: string; password: string }) => {
      if (!pending.delete(id)) return
      clearTimeout(timer)
      callback(credentials?.username, credentials?.password)
    }
    pending.set(id, { token, details: { requestId: id, url: details.url, isProxy: true, scheme: auth.scheme, realm: auth.realm, challenger: { host: auth.host, port: auth.port } }, finish })
  })
}

export async function releaseExtensionProxy(key: string) {
  for (const [token, item] of permissions) if (item.key === key) {
    if (owner === token) await extensionProxyRequest(token, { action: "clear" })
    permissions.delete(token)
    for (const request of pending.values()) if (request.token === token) request.finish()
  }
}

export async function extensionProxyRequest(token: string, data: any) {
  if (!permissions.get(token)?.allowed()) throw new Error("扩展未启用或没有代理权限")
  if (data.action === "get") return { value, levelOfControl: !owner ? "controllable_by_this_extension" : owner === token ? "controlled_by_this_extension" : "controlled_by_other_extensions" }
  if (data.action === "auth-poll") return [...pending.values()].filter((item) => item.token === token).map((item) => item.details)
  if (data.action === "auth-reply") {
    const request = pending.get(data.requestId)
    if (request?.token === token) {
      const credentials = data.authCredentials
      request.finish(typeof credentials?.username === "string" && typeof credentials.password === "string" ? credentials : undefined)
    }
    return {}
  }
  if (!["set", "clear"].includes(data.action)) throw new Error("无效的代理操作")
  const operation = queue.then(async () => {
    if (!permissions.get(token)?.allowed()) throw new Error("扩展已禁用")
    if (data.action === "clear" && owner !== token) return {}
    const next = data.action === "clear" ? { mode: "system" } : data.value
    await browser().setProxy(extensionProxyConfig(next))
    await browser().closeAllConnections()
    owner = data.action === "clear" ? "" : token
    value = next
    return {}
  })
  queue = operation.then(() => {}, () => {})
  return operation
}
