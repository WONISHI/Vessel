import { resolve } from "node:path"
import { build, type Plugin } from "vite"

/** Remote pages do not share the app's React runtime or CSS; bundle the guest UI offline. */
export function guestScriptPlugin(root: string): Plugin {
  const suffix = "?guest-script"
  return {
    name: "vessel-guest-script",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.endsWith(suffix)) return
      const entry = await this.resolve(source.slice(0, -suffix.length), importer, { skipSelf: true })
      return entry ? entry.id + suffix : undefined
    },
    async load(id) {
      if (!id.endsWith(suffix)) return
      const result = await build({
        configFile: false, mode: "production", root, logLevel: "silent", publicDir: false,
        esbuild: { jsx: "automatic", jsxDev: false },
        resolve: { alias: { "@": resolve(root, "src/renderer/src") } },
        define: { "process.env.NODE_ENV": '"production"' },
        build: {
          write: false, minify: true, target: "chrome120",
          lib: { entry: id.slice(0, -suffix.length), formats: ["iife"], name: "VesselGuest" }
        }
      })
      const outputs = Array.isArray(result) ? result : [result]
      const chunk = outputs.flatMap(output => "output" in output ? output.output : []).find(output => output.type === "chunk")
      if (!chunk || chunk.type !== "chunk") throw new Error("Guest UI bundle missing")
      for (const file of Object.keys(chunk.modules)) {
        if (file.startsWith(root) && !file.includes("\0") && !file.includes("?")) this.addWatchFile(file)
      }
      return `export default ${JSON.stringify(chunk.code)}`
    }
  }
}
