import { expect, it } from "vitest"
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node-pty"
import { terminalDirectory } from "../../src/main/terminal"
it("uses file parent or workspace root and rejects escapes", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-terminal-"))
  try {
    await mkdir(join(root, "src"))
    const file = join(root, "src", "main.ts")
    await writeFile(file, "")
    const cwd = await terminalDirectory(root, file)
    expect(cwd.endsWith("/src")).toBe(true)
    expect((await terminalDirectory(root)).endsWith(root.split("/").pop()!)).toBe(true)
    await expect(terminalDirectory(root, tmpdir())).rejects.toThrow("工作区")
    const output = await new Promise<string>((resolve, reject) => {
      const terminal = spawn("/bin/sh", ["-c", "pwd"], { cwd, cols: 80, rows: 24, env: process.env as Record<string, string> })
      let text = ""
      const timeout = setTimeout(() => { terminal.kill(); reject(new Error("timeout")) }, 5000)
      terminal.onData(data => { text += data })
      terminal.onExit(() => { clearTimeout(timeout); resolve(text) })
    })
    expect(output.trim()).toBe(cwd)
  } finally { await rm(root, { recursive: true, force: true }) }
})
