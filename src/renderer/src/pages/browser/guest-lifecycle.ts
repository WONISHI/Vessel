import type { WebviewTag } from "electron"
const ready = new WeakSet<WebviewTag>()
export function markGuestReady(view: WebviewTag, value: boolean) {
  if (value) ready.add(view)
  else ready.delete(view)
}
/** A ref exists before Electron's guest is ready and after its frame is detached. */
export function withGuest<T>(view: WebviewTag | null | undefined, action: (view: WebviewTag) => T): T | undefined {
  if (!view?.isConnected || !ready.has(view)) return undefined
  try { return action(view) } catch { return undefined }
}
