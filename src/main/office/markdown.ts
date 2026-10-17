import { app } from "electron"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { extname, join } from "node:path"
import { promisify } from "node:util"

const execute = promisify(execFile)

/** Converts an exported document locally without changing its original file. */
export async function convertOfficeMarkdown(name: string, bytes: Uint8Array): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "vessel-markitdown-"))
  try {
    const input = join(directory, `document${extname(name).toLowerCase()}`)
    const output = join(directory, "document.md")
    await writeFile(input, bytes)
    const python = process.env.VESSEL_MARKITDOWN_PYTHON || (app.isPackaged ? join(process.resourcesPath, "markitdown", "bin", "python3") : join(app.getAppPath(), ".venv-markitdown", "bin", "python3"))
    try {
      await execute(python, ["-c", "import sys; from pathlib import Path; from markitdown import MarkItDown; result = MarkItDown().convert(sys.argv[1]); Path(sys.argv[2]).write_text(result.text_content, encoding='utf-8')", input, output], { timeout: 120000, maxBuffer: 2 * 1024 * 1024 })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("MarkItDown 运行环境未安装，请配置 VESSEL_MARKITDOWN_PYTHON（Python 3.10+ 并安装 markitdown）。")
      throw new Error(`MarkItDown 转换失败：${(error as { stderr?: string }).stderr?.trim() || String(error)}`)
    }
    return await readFile(output, "utf8")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/** Creates a Markdown file without replacing an existing document. */
export async function saveConvertedMarkdown(directory: string, name: string, markdown: string) {
  const stem = name.replace(/\.[^.]+$/, "")
  for (let index = 0; ; index++) {
    const path = join(directory, `${stem}${index ? `-${index}` : ""}.md`)
    try {
      await writeFile(path, markdown, { encoding: "utf8", flag: "wx" })
      return path
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    }
  }
}
