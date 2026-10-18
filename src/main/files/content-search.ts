import { generalSettings, parseIgnoredPatterns } from "@main/settings/settings"
import type { ContentMatch, ContentSearchOptions, ContentSearchResult } from "@vessel/type"
import { rgPath } from "@vscode/ripgrep"
import { BrowserWindow, dialog, type WebContents } from "electron"
import { spawn, type ChildProcess } from "node:child_process"
import { realpath, stat } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"

/** Performs the search content operation. */
export async function searchContent(options: ContentSearchOptions, signal?: AbortSignal): Promise<ContentSearchResult> {
  if (!options || typeof options.root !== "string" || !isAbsolute(options.root) || typeof options.query !== "string" || options.query.length > 4096) throw new Error("搜索参数无效")
  if (signal?.aborted) throw new Error("搜索已取消")
  const root = await realpath(options.root)
  if (!(await stat(root)).isDirectory()) throw new Error("搜索范围必须是文件夹")
  if (!options.query) return { matches: [], truncated: false }
  const args = ["--json", "--hidden", "--glob", "!.git/**", "--color", "never"]
  if (!options.includeIgnored) {
    for (const pattern of parseIgnoredPatterns(generalSettings().ignoredFiles)) {
      args.push("--glob", `!${pattern}/**`, "--glob", `!${pattern}`)
    }
  }
  if (!options.caseSensitive) args.push("--ignore-case")
  if (!options.regex) args.push("--fixed-strings")
  if (options.wholeWord) args.push("--word-regexp")
  if (options.includeIgnored) args.push("--no-ignore")
  for (const [key, exclude] of [
    ["include", false],
    ["exclude", true]
  ] as const) {
    const value = options[key]
    if (value !== undefined && (typeof value !== "string" || value.length > 4096)) throw new Error("文件过滤无效")
    for (const glob of value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [])
      args.push("--glob", `${exclude ? "!" : ""}${glob}`)
  }
  args.push("--", options.query, ".")
  return new Promise((resolveResult, reject) => {
    const child: ChildProcess = spawn(rgPath.replace(/app\.asar([/\\])/, "app.asar.unpacked$1"), args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    const matches: ContentMatch[] = []
    let pending = "",
      stderr = "",
      truncated = false,
      timedOut = false

    /** Aborts abort. */
    const abort = () => child.kill()
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) abort()
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, 30000)

    /** Performs the cleanup operation. */
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", abort)
    }
    child.stdout!.setEncoding("utf8")
    child.stderr!.setEncoding("utf8")
    child.stderr!.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(0, 4096)
    })
    child.stdout!.on("data", (chunk: string) => {
      if (truncated) return
      pending += chunk
      if (pending.length > 4 * 1024 * 1024) {
        truncated = true
        child.kill()
        return
      }
      let newline: number
      while ((newline = pending.indexOf("\n")) >= 0) {
        const raw = pending.slice(0, newline)
        pending = pending.slice(newline + 1)
        try {
          const entry = JSON.parse(raw)
          if (entry.type !== "match" || !entry.data.path.text || !entry.data.lines.text) continue
          const data = entry.data,
            text = data.lines.text.replace(/\r?\n$/, "")
          const bytes = Buffer.from(text)
          const ranges = data.submatches.map((match: { start: number; end: number }) => ({ start: bytes.subarray(0, match.start).toString("utf8").length, end: bytes.subarray(0, match.end).toString("utf8").length }))
          for (const range of ranges) {
            const start = Math.max(0, range.start - 120)
            const end = Math.min(text.length, range.end + 240)
            matches.push({
              path: resolve(root, data.path.text),
              relativePath: data.path.text.replace(/^\.\//, ""),
              line: data.line_number,
              column: range.start + 1,
              text: text.slice(start, end),
              ranges: [{ start: range.start - start, end: range.end - start }]
            })
            if (matches.length >= 2000) {
              truncated = true
              child.kill()
              break
            }
          }
          if (truncated) break
        } catch {
          /* Ignore non-match or malformed records. */
        }
      }
    })
    child.once("error", (error) => {
      cleanup()
      reject(error)
    })
    child.once("close", (code) => {
      cleanup()
      if (signal?.aborted) reject(new Error("搜索已取消"))
      else if (timedOut) reject(new Error("搜索超过 30 秒，请缩小范围"))
      else if (!truncated && code !== 0 && code !== 1) reject(new Error(stderr.trim() || "搜索引擎退出异常"))
      else resolveResult({ matches, truncated })
    })
  })
}

/** Registers content search. */
export function registerContentSearch(host: WebContents) {
  let active: AbortController | undefined
  host.ipc.handle("search:content", async (_event, options: ContentSearchOptions) => {
    active?.abort()
    const controller = new AbortController()
    active = controller
    try {
      return await searchContent(options, controller.signal)
    } finally {
      if (active === controller) active = undefined
    }
  })
  host.ipc.on("search:cancel", () => active?.abort())
  host.once("destroyed", () => active?.abort())
  host.ipc.handle("search:pick-folder", async () => {
    const owner = BrowserWindow.fromWebContents(host)
    const options = { title: "选择搜索文件夹", properties: ["openDirectory"] as "openDirectory"[] }
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
}
