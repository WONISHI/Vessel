import { randomUUID } from "node:crypto"

const handlers = new Map<string, (url: string) => boolean>()
export function hasExtensionBridgeToken(token: unknown): boolean {
  return typeof token === "string" && handlers.has(token)
}

/** Capability scoped to one loaded extension and this app process. */
export function registerExtensionTabBridge(open: (url: string) => boolean) {
  const token = randomUUID()
  handlers.set(token, open)
  return token
}

export function openExtensionTab(token: unknown, target: unknown): boolean {
  if (typeof token !== "string" || typeof target !== "string" || target.length > 16384) return false
  let url: URL
  try { url = new URL(target) } catch { return false }
  if (!["https:", "http:", "chrome-extension:"].includes(url.protocol)) return false
  return handlers.get(token)?.(url.href) ?? false
}
