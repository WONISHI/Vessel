import { spawn } from "node:child_process"

/** Run an interruptible Git process, including its transport and hook children. */
export async function runCancellableGit(args: string[], cwd: string, signal: AbortSignal): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  signal.throwIfAborted()
  let binary = "git"
  let env: NodeJS.ProcessEnv = { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" }
  try {
    const { setupEnvironment } = await import("dugite")
    const embedded = setupEnvironment(env)
    binary = embedded.gitLocation
    env = embedded.env
  } catch { /* Fall back to system Git if the bundled environment is unavailable. */ }
  const run = (executable: string) => new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
    signal.throwIfAborted()
    const child = spawn(executable, args, { cwd, env, detached: process.platform !== "win32", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = "", stderr = ""
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = () => {
      if (!child.pid) return
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on("error", () => child.kill())
      } else {
        const kill = (kind: NodeJS.Signals) => {
          try { process.kill(-child.pid!, kind) } catch { /* The group has already exited. */ }
        }
        kill("SIGTERM")
        timer = setTimeout(() => kill("SIGKILL"), 1000)
        timer.unref()
      }
    }
    signal.addEventListener("abort", stop, { once: true })
    if (signal.aborted) stop()
    const cleanup = () => {
      signal.removeEventListener("abort", stop)
      clearTimeout(timer)
    }
    child.stdout.setEncoding("utf8").on("data", data => { stdout += data })
    child.stderr.setEncoding("utf8").on("data", data => { stderr += data })
    child.on("error", error => { cleanup(); reject(error) })
    child.on("close", code => {
      cleanup()
      if (signal.aborted) reject(new Error("推送已取消"))
      else resolve({ stdout, stderr, exitCode: code ?? 1 })
    })
  })
  try { return await run(binary) }
  catch (error) {
    if (!signal.aborted && binary !== "git" && (error as NodeJS.ErrnoException).code === "ENOENT") return run("git")
    throw error
  }
}
