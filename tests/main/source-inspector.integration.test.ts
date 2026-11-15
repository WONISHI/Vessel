import { mkdtemp, writeFile, symlink, rm, readFile, realpath, copyFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawn, type ChildProcess } from "node:child_process"
import { once } from "node:events"
import { expect, it } from "vitest"

// Run with VESSEL_INSPECTOR_FIXTURE pointing to a temporary npm project containing
// vite@5, @vitejs/plugin-vue@5 and vue@3. No fixture dependencies are added to Vessel.
it.skipIf(!process.env.VESSEL_INSPECTOR_FIXTURE)("serves exact Vue locations without changing sources and releases the server", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "vessel-inspector-test-")))
  const runnerDirectory = await mkdtemp(join(tmpdir(), "vessel-inspector-runner-"))
  let child: ChildProcess | undefined
  const source = '<template>\n  <main>\n    <button @click="count++">中文 {{ count }}</button>\n  </main>\n</template>\n<script setup>\nimport { ref } from "vue"\nconst count = ref(0)\n</script>'
  const config = 'import vue from "@vitejs/plugin-vue"; export default { plugins: [vue()], server: { port: 0 } }'
  try {
    await symlink(join(process.env.VESSEL_INSPECTOR_FIXTURE!, "node_modules"), join(root, "node_modules"), "dir")
    await Promise.all([writeFile(join(root, "package.json"), '{"type":"module"}'), writeFile(join(root, "vite.config.mjs"), config), writeFile(join(root, "App.vue"), source), writeFile(join(root, "index.html"), '<div id="app"></div><script type="module" src="/main.js"></script>'), writeFile(join(root, "main.js"), 'import {createApp} from "vue";import App from "./App.vue";createApp(App).mount("#app")')])
    await Promise.all([copyFile(resolve("src/main/source-inspector/runner.mjs"), join(runnerDirectory, "runner.mjs")), copyFile(resolve("src/main/source-inspector/client.js"), join(runnerDirectory, "client.js"))])
    child = spawn("node", [join(runnerDirectory, "runner.mjs"), "{}"], { cwd: root, stdio: ["ignore", "pipe", "pipe", "ipc"] })
    let logs = ""
    child.stderr!.on("data", chunk => { logs += chunk })
    const url = await new Promise<string>((resolve, reject) => {
      child!.on("message", (message: any) => { if (message.type === "ready") resolve(message.url); if (message.type === "error") reject(Error(message.error)) })
      child!.on("error", reject)
      child!.on("exit", code => reject(Error(`exit ${code}: ${logs}`)))
    })
    expect(await (await fetch(url)).text()).toContain('/__vessel_source_client.js')
    const client = await (await fetch(new URL('/__vessel_source_client.js', url))).text()
    const token = client.match(/'x-vessel-source-token': '([^']+)'/)![1]
    const compiled = await (await fetch(new URL('/App.vue', url))).text()
    const keys = [...compiled.matchAll(/"data-vessel-source": "(\d+)"/g)].map(match => match[1])
    expect(keys).toHaveLength(2)
    const endpoint = new URL('/__vessel_source_open', url)
    expect((await fetch(endpoint, { method: "POST", body: JSON.stringify({ key: keys[1] }) })).status).toBe(403)
    let location: any
    child.on("message", (message: any) => {
      if (message.type === "open") { location = message; child!.send({ type: "opened", requestId: message.requestId }) }
    })
    expect((await fetch(endpoint, { method: "POST", headers: { "x-vessel-source-token": token }, body: JSON.stringify({ key: keys[1] }) })).status).toBe(200)
    expect(location).toMatchObject({ file: join(root, "App.vue"), line: 3, column: 5 })
    expect((await fetch(endpoint, { method: "POST", headers: { "x-vessel-source-token": token }, body: JSON.stringify({ key: "/etc/passwd" }) })).status).toBe(400)
    expect(await readFile(join(root, "App.vue"), "utf8")).toBe(source)
    expect(await readFile(join(root, "vite.config.mjs"), "utf8")).toBe(config)
    expect(await readFile(join(root, "package.json"), "utf8")).toBe('{"type":"module"}')
    const exit = once(child, "exit")
    child.kill("SIGTERM")
    await exit
    await expect(fetch(url, { signal: AbortSignal.timeout(3000) })).rejects.toThrow()
  } finally {
    if (child?.exitCode === null && !child.signalCode) { const exit = once(child, "exit"); child.kill("SIGKILL"); await exit }
    await rm(root, { recursive: true, force: true })
    await rm(runnerDirectory, { recursive: true, force: true })
  }
}, 30000)
