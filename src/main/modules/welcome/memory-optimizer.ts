import { app, webContents, type Session } from "electron"
import { runInNewContext } from "node:vm"
import { setFlagsFromString } from "node:v8"

export type MemoryOptimizeResult = { beforeBytes: number; afterBytes: number; targets: number; failed: number }

const total = () => app.getAppMetrics().reduce((sum, item) => sum + item.memory.workingSetSize * 1024, 0)

/** Forces a V8 collection in the main process (the flag is enabled lazily; gc is otherwise not exposed). */
function collectMain() {
  try {
    setFlagsFromString("--expose-gc")
    runInNewContext("gc")?.()
  } catch {
    /* gc stays unavailable; cache clearing below still helps */
  }
}

/** Collects garbage and asks Blink to drop purgeable caches in one renderer (pages, webviews, extension views). */
async function trimRenderer(contents: Electron.WebContents) {
  const attached = contents.debugger.isAttached()
  // Leave pages that already have DevTools attached alone: a second client would detach it.
  if (attached) return false
  contents.debugger.attach("1.3")
  try {
    await contents.debugger.sendCommand("HeapProfiler.enable")
    await contents.debugger.sendCommand("HeapProfiler.collectGarbage")
    await contents.debugger.sendCommand("Memory.simulatePressureNotification", { level: "critical" })
    await contents.debugger.sendCommand("HeapProfiler.disable")
    return true
  } finally {
    try { contents.debugger.detach() } catch { /* already detached */ }
  }
}

/** Releases reclaimable memory: V8 heaps, Blink/Skia caches, HTTP and code caches. User state is never touched. */
export async function optimizeMemory(): Promise<MemoryOptimizeResult> {
  const beforeBytes = total()
  const targets = webContents.getAllWebContents().filter((contents) => !contents.isDestroyed() && !contents.getURL().startsWith("devtools://") && contents.getType() !== "backgroundPage")
  const results = await Promise.allSettled(targets.map(trimRenderer))
  const sessions = new Set<Session>(targets.map((contents) => contents.session))
  await Promise.allSettled([...sessions].flatMap((session) => [session.clearCache(), session.clearCodeCaches({})]))
  collectMain()
  // Give the OS a moment to take back the freed pages before measuring again.
  await new Promise((resolve) => setTimeout(resolve, 800))
  collectMain()
  return { beforeBytes, afterBytes: total(), targets: results.filter((item) => item.status === "fulfilled" && item.value).length, failed: results.filter((item) => item.status === "rejected").length }
}
