import { createRequire } from "node:module"
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { expect, it } from "vitest"

const require = createRequire(import.meta.url)
const builderRequire = createRequire(require.resolve("electron-builder"))
const { FileMatcher } = builderRequire("app-builder-lib/out/fileMatcher")
const { verifyNativeTarget } = require("../../scripts/verify-native-target.cjs")
const config = require("../../package.json").build
const root = process.cwd()
const targets = [["mac", "darwin", "arm64"], ["mac", "darwin", "x64"], ["win", "win32", "x64"], ["win", "win32", "arm64"], ["linux", "linux", "x64"]] as const

it.each(targets)("filters native packages for %s %s %s independently of the host", (section, platform, arch) => {
  for (const staged of [false, true]) {
    const patterns = config[section].files.map((p: string) => staged ? p.replace("!**/node_modules/", "!**/") : p)
    const filter = new FileMatcher(root, "/unused", (s: string) => s.replaceAll("${arch}", arch), ["**/*", ...patterns]).createFilter()
    const prefix = staged ? "" : "node_modules/"
    const included = (relative: string, directory = false) => filter(path.join(root, prefix, relative), { isDirectory: () => directory })
    for (const name of ["pty.node", "conpty.node", "conpty_console_list.node", "winpty.dll", "winpty-agent.exe", "spawn-helper"]) expect(included(`node-pty/prebuilds/${platform}-${arch}/${name}`)).toBe(true)
    for (const [, otherPlatform, otherArch] of targets) {
      if (otherPlatform === platform && otherArch === arch) continue
      for (const packagePath of [`node-pty/prebuilds/${otherPlatform}-${otherArch}`, `@parcel/watcher-${otherPlatform}-${otherArch}`, `@vscode/ripgrep-${otherPlatform}-${otherArch}`]) {
        expect(included(packagePath, true), packagePath).toBe(false)
        expect(included(`${packagePath}/native.node`), packagePath).toBe(false)
      }
    }
    for (const name of ["node-pty/lib/index.js", "node-pty/build/Release/pty.node", "@parcel/watcher/index.js", "@vscode/ripgrep/lib/index.js", "better-sqlite3/build/Release/better_sqlite3.node", "dugite/git/bin/git.exe"]) expect(included(name)).toBe(true)
    expect(included(`@parcel/watcher-${platform}-${arch}/watcher.node`)).toBe(true)
    expect(included(`@vscode/ripgrep-${platform}-${arch}/bin/rg.exe`)).toBe(true)
  }
})

it("retains all Windows terminal companions and rejects a missing DLL or foreign target", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "vessel-native-win-"))
  try {
    const source = path.dirname(require.resolve("node-pty/package.json"))
    const filters = config.win.files
    const filter = new FileMatcher(root, "/unused", (s: string) => s.replaceAll("${arch}", "x64"), ["**/*", ...filters]).createFilter()
    await cp(path.join(source, "prebuilds"), path.join(temp, "node-pty/prebuilds"), { recursive: true, filter: async file => filter(path.join(root, "node_modules/node-pty/prebuilds", path.relative(path.join(source, "prebuilds"), file)), await lstat(file)) })
    for (const [scope, name, binary] of [["@parcel", "watcher-win32-x64", "watcher.node"], ["@vscode", "ripgrep-win32-x64", "bin/rg.exe"]]) {
      const target = path.join(temp, scope, name, binary)
      await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, "fixture")
    }
    expect(await readdir(path.join(temp, "node-pty/prebuilds"))).toEqual(["win32-x64"])
    for (const name of ["winpty.dll", "winpty-agent.exe", "conpty.node"]) {
      expect(await readFile(path.join(temp, "node-pty/prebuilds/win32-x64", name))).toEqual(await readFile(path.join(source, "prebuilds/win32-x64", name)))
    }
    await verifyNativeTarget(temp, "win32", "x64")
    await rm(path.join(temp, "node-pty/prebuilds/win32-x64/winpty.dll"))
    await expect(verifyNativeTarget(temp, "win32", "x64")).rejects.toMatchObject({ code: "ENOENT" })
    await mkdir(path.join(temp, "node-pty/prebuilds/darwin-arm64"))
    await expect(verifyNativeTarget(temp, "win32", "x64")).rejects.toThrow("Foreign terminal binary")
  } finally { await rm(temp, { recursive: true, force: true }) }
})

it.each(["mac", "win", "linux"])("keeps the application file allowlist when %s overrides root file patterns", section => {
  const { getFileMatchers } = builderRequire("app-builder-lib/out/fileMatcher")
  // electron-builder normalizes root strings into a FileSet, whereas platform
  // strings create the first/default matcher. Excludes alone enable **/*.
  const normalized = { ...config, files: [{ filter: config.files }] }
  const matchers = getFileMatchers(normalized, "files", "/destination", {
    defaultSrc: root, globalOutDir: path.join(root, "dist"),
    macroExpander: (value: string) => value.replaceAll("${arch}", "arm64"), customBuildOptions: config[section]
  })
  const first = matchers[0]
  expect(first.containsOnlyIgnore()).toBe(false)
  const included = (relative: string) => matchers.some((m: any) => m.createFilter()(path.join(root, relative), { isDirectory: () => false }))
  expect(included("out/main/index.js")).toBe(true)
  expect(included("out/renderer/index.html")).toBe(true)
  expect(included("package.json")).toBe(true)
  for (const name of ["resources/markitdown/bin/python", "tmp/python-build-standalone/cache.whl", "src/renderer/out/renderer/index.html", "src/renderer/public/ocr/ppocr_det.onnx", "packages/@vessel/workspace/dist/index.js", "output/pdf/private.pdf"]) expect(included(name), `${section}: ${name}`).toBe(false)
})
