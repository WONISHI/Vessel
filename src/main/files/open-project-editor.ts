import { execFile } from "node:child_process"
import { realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)

/** Launch an editor with an argument array, preserving spaces and avoiding a shell. */
export async function openProjectInEditor(path: unknown, filePath?: unknown, line?: unknown, column?: unknown): Promise<string> {
  if (typeof path !== "string" || !isAbsolute(path) || path.includes("\0")) throw new Error("项目路径无效")
  const root = await realpath(path)
  if (!(await stat(root)).isDirectory()) throw new Error("项目路径不是文件夹")
  let file: string | undefined
  if (filePath !== undefined) {
    if (typeof filePath !== "string" || !filePath || filePath.includes("\0")) throw new Error("文件路径无效")
    file = await realpath(resolve(root, filePath))
    const offset = relative(root, file)
    if (isAbsolute(offset) || offset === ".." || offset.startsWith(`..${sep}`)) throw new Error("文件不在项目目录内")
    if (!(await stat(file)).isFile()) throw new Error("指定路径不是文件")
  }
  for (const value of [line, column]) if (value !== undefined && (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 10000000)) throw new Error("源码行列位置无效")
  if ((line !== undefined || column !== undefined) && !file) throw new Error("定位源码需要指定文件")
  const position = file && line !== undefined ? `${file}:${line}:${column ?? 1}` : file
  const codeArgs = file ? [line !== undefined ? "--reuse-window" : "--new-window", root, "--goto", position!] : [root]
  const stormArgs = file ? [root, ...(line !== undefined ? ["--line", String(line), "--column", String(column ?? 1)] : []), file] : [root]
  const candidates = process.platform === "darwin"
    ? [
        { name: "VS Code", executable: "/usr/bin/open", args: file ? ["-n", "-b", "com.microsoft.VSCode", "--args", ...codeArgs] : ["-b", "com.microsoft.VSCode", root] },
        { name: "WebStorm", executable: "/usr/bin/open", args: file ? ["-n", "-b", "com.jetbrains.WebStorm", "--args", ...stormArgs] : ["-b", "com.jetbrains.WebStorm", root] }
      ]
    : [
        { name: "VS Code", executable: process.platform === "win32" ? "Code.exe" : "code", args: codeArgs },
        { name: "WebStorm", executable: process.platform === "win32" ? "webstorm64.exe" : "webstorm", args: stormArgs }
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
