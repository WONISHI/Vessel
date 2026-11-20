import { execFileSync } from "node:child_process"
import type { IPty } from "node-pty"

/** Read IDs only; command lines and environment variables can contain credentials. */
function descendants(root: number): number[] {
  const output = execFileSync("/bin/ps", ["-axo", "pid=,ppid="], { encoding: "utf8", timeout: 1500, maxBuffer: 4 * 1024 * 1024 })
  const children = new Map<number, number[]>()
  for (const line of output.trim().split("\n")) {
    const [pid, parent] = line.trim().split(/\s+/).map(Number)
    if (!Number.isSafeInteger(pid) || !Number.isSafeInteger(parent)) continue
    const siblings = children.get(parent) || []
    siblings.push(pid)
    children.set(parent, siblings)
  }
  const found = new Set([root])
  for (const parent of found) for (const child of children.get(parent) || []) found.add(child)
  return [...found]
}

/** Closing a terminal must also stop job-control groups and detached children started by its commands. */
export function terminateTerminalTree(terminal: Pick<IPty, "pid" | "kill">): void {
  const root = terminal.pid
  if (!Number.isSafeInteger(root) || root <= 1 || root === process.pid) return
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill.exe", ["/PID", String(root), "/T", "/F"], { windowsHide: true, timeout: 5000, stdio: "ignore" })
    } catch { /* It may have exited before taskkill; ConPTY cleanup below is still required. */ }
    finally { try { terminal.kill() } catch { /* The pty may already be closed. */ } }
    return
  }
  const stopped = new Set<number>()
  const signal = (pid: number, value: NodeJS.Signals) => {
    if (pid === process.pid || Math.abs(pid) <= 1) return false
    try { process.kill(pid, value); return true } catch { return false }
  }
  try {
    // Freeze parents before enumerating again, preventing npm/shell wrappers from
    // spawning or reparenting children while we terminate their process tree.
    if (signal(root, "SIGSTOP")) stopped.add(root)
    for (let attempt = 0; attempt < 4; attempt++) {
      let added = false
      for (const pid of descendants(root)) {
        if (!stopped.has(pid) && signal(pid, "SIGSTOP")) { stopped.add(pid); added = true }
      }
      if (!added) break
    }
  } catch (error) {
    console.error("读取终端进程树失败，改为结束终端进程组", error)
    signal(-root, "SIGKILL")
  } finally {
    // Kill discovered children before their shell so closing the pty cannot
    // orphan them. The final signal also covers a shell missed by the snapshot.
    for (const pid of [...stopped].reverse()) signal(pid, "SIGKILL")
    try { terminal.kill("SIGKILL") } catch { /* The pty may already be closed. */ }
  }
}
