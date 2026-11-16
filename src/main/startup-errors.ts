import { app } from "electron"
import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

/** GUI launches have no terminal; retain startup errors for diagnosis. */
export function reportStartupError(context: string, error: unknown): string | undefined {
  const detail = error instanceof Error ? error.stack || error.message : String(error)
  console.error(context, detail)
  try {
    const directory = app.getPath("userData")
    mkdirSync(directory, { recursive: true })
    const log = join(directory, "startup.log")
    appendFileSync(log, `[${new Date().toISOString()}] ${context}\n${detail}\n`, { mode: 0o600 })
    return log
  } catch { return undefined }
}
