import { execFile } from "node:child_process"
import { realpath, stat } from "node:fs/promises"
import { isAbsolute } from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)

/** Launch an editor with an argument array, preserving spaces and avoiding a shell. */
export async function openProjectInEditor(path: unknown): Promise<string> {
  if (typeof path !== "string" || !isAbsolute(path) || path.includes("\0")) throw new Error("项目路径无效")
  const root = await realpath(path)
  if (!(await stat(root)).isDirectory()) throw new Error("项目路径不是文件夹")
  const candidates = process.platform === "darwin"
    ? [
        { name: "VS Code", executable: "/usr/bin/open", args: ["-b", "com.microsoft.VSCode", root] },
        { name: "WebStorm", executable: "/usr/bin/open", args: ["-b", "com.jetbrains.WebStorm", root] }
      ]
    : [
        { name: "VS Code", executable: process.platform === "win32" ? "Code.exe" : "code", args: [root] },
        { name: "WebStorm", executable: process.platform === "win32" ? "webstorm64.exe" : "webstorm", args: [root] }
      ]
  for (const candidate of candidates) {
    try {
      await run(candidate.executable, candidate.args, { timeout: 15000, windowsHide: true })
      return candidate.name
    } catch {
      // LaunchServices also finds user-installed and Toolbox-managed macOS apps.
    }
  }
  throw new Error("无法打开 VS Code 或 WebStorm，请确认已安装其中一个编辑器")
}
