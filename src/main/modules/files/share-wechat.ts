import { clipboard, shell } from "electron"
import { realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, sep } from "node:path"
import { pathToFileURL } from "node:url"

/** Copy native file references for WeChat's file attachment paste, never plain URL text. */
export async function shareFilesToWechat(root: string, paths: string[]) {
  if (typeof root !== "string" || !Array.isArray(paths) || !paths.length || paths.length > 50 || paths.some((path) => typeof path !== "string" || !isAbsolute(path))) throw new Error("请选择不超过 50 个文件")
  const base = await realpath(root)
  const files = await Promise.all(paths.map(async (path) => {
    const resolved = await realpath(path)
    const offset = relative(base, resolved)
    if (!offset || offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw new Error("文件不在当前工作区内")
    if (!(await stat(resolved)).isFile()) throw new Error("仅支持发送文件，请先压缩文件夹")
    return resolved
  }))
  // macOS file-url pasteboard accepts one file per item; use the native sharing menu for multiple files.
  if (process.platform === "darwin" && files.length > 1) throw new Error("请逐个发送文件")
  clipboard.clear()
  const urls = files.map((file) => pathToFileURL(file).href)
  if (process.platform === "darwin") clipboard.writeBuffer("public.file-url", Buffer.from(urls[0]))
  else if (process.platform === "win32") {
    const header = Buffer.alloc(20)
    header.writeUInt32LE(20, 0)
    header.writeUInt32LE(1, 16)
    clipboard.writeBuffer("CF_HDROP", Buffer.concat([header, Buffer.from(files.join("\0") + "\0\0", "utf16le")]))
  } else {
    clipboard.writeBuffer("text/uri-list", Buffer.from(urls.join("\r\n") + "\r\n"))
    clipboard.writeBuffer("x-special/gnome-copied-files", Buffer.from("copy\n" + urls.join("\n")))
  }
  try {
    await shell.openExternal("weixin://")
    return { opened: true }
  } catch {
    return { opened: false }
  }
}
