/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs/promises")
const path = require("node:path")

/** Inspect packaged files, never the host's node_modules. */
async function verifyNativeTarget(nativeRoot, platform, arch) {
  const prebuilds = path.join(nativeRoot, "node-pty/prebuilds")
  const expected = `${platform}-${arch}`
  const entries = await fs.readdir(prebuilds, { withFileTypes: true }).catch(error => { if (error.code === "ENOENT") return []; throw error })
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== expected) throw new Error(`Foreign terminal binary packaged for ${expected}: ${entry.name}`)
  }
  const required = platform === "win32"
    ? ["conpty.node", "conpty_console_list.node", "pty.node", "winpty.dll", "winpty-agent.exe"]
    : ["pty.node", "spawn-helper"]
  if (platform === "linux" && !entries.some(entry => entry.name === expected)) await fs.access(path.join(nativeRoot, "node-pty/build/Release/pty.node"))
  else for (const name of required) await fs.access(path.join(prebuilds, expected, name))
  for (const [scope, prefix] of [["@parcel", "watcher-"], ["@vscode", "ripgrep-"]]) {
    for (const entry of await fs.readdir(path.join(nativeRoot, scope), { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue
      const target = entry.name.slice(prefix.length)
      if (target !== expected && !(platform === "linux" && target.startsWith(`${expected}-`))) throw new Error(`Foreign native package included: ${scope}/${entry.name}`)
    }
  }
  console.log(`Packaged native target OK: ${expected}; terminal companions retained`)
}

module.exports = { verifyNativeTarget }
