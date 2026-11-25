import { createRequire } from "node:module"
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { runInNewContext } from "node:vm"
import { expect, it } from "vitest"

const require = createRequire(import.meta.url)
const builderRequire = createRequire(require.resolve("electron-builder"))
const { FileMatcher } = builderRequire("app-builder-lib/out/fileMatcher")
const config = require("../../package.json").build
const sqliteExclusions = config.files.filter((p: unknown) => typeof p === "string" && p.startsWith("!**/node_modules/better-sqlite3/"))
const root = process.cwd()
const matcher = (from: string, patterns: string[]) => new FileMatcher(from, "/unused", (value: string) => value, patterns).createFilter()

it("filters only unsupported Office UI/formula translations, preserving supported languages and engine resources", async () => {
  const office = path.join(root, "resources/office")
  const filter = matcher(office, config.extraResources.find((r: { to: string }) => r.to === "office").filter)
  const prefix = "v9.3.0.24-1/web-apps/apps/"
  const file = { isDirectory: () => false }
  for (const editor of ["documenteditor", "spreadsheeteditor", "presentationeditor", "pdfeditor", "visioeditor"]) {
    for (const lang of ["en", "zh", "zh-tw"]) {
      const relative = `${prefix}${editor}/main/locale/${lang}.json`
      expect(filter(path.join(office, relative), file)).toBe(true)
      expect(JSON.parse(await readFile(path.join(office, relative), "utf8"))).toBeTruthy()
    }
    for (const lang of ["fr", "de", "pt-pt", "sr-cyrl"]) expect(filter(path.join(office, `${prefix}${editor}/main/locale/${lang}.json`), file)).toBe(false)
  }
  for (const lang of ["en", "zh", "zh-tw", "zh-tw_desc"]) expect(filter(path.join(office, `${prefix}spreadsheeteditor/main/resources/formula-lang/${lang}.json`), file)).toBe(true)
  for (const lang of ["fr", "fr_desc", "de", "de_desc"]) expect(filter(path.join(office, `${prefix}spreadsheeteditor/main/resources/formula-lang/${lang}.json`), file)).toBe(false)
  for (const relative of ["x2t/x2t.wasm", "v9.3.0.24-1/sdkjs/word/sdk-all.js", `${prefix}documenteditor/main/index.html`, "v9.3.0.24-1/sdkjs/pdf/src/annotations/stamps/de-DE.json"]) expect(filter(path.join(office, relative), file)).toBe(true)
})

it("preserves SQLite runtime files with normal and staged Windows file filters", () => {
  const file = { isDirectory: () => false }
  for (const windows of [false, true]) {
    const filter = matcher(root, ["**/*", ...sqliteExclusions.map((p: string) => windows ? p.replace("!**/node_modules/", "!**/") : p)])
    const prefix = windows ? "better-sqlite3/" : "node_modules/better-sqlite3/"
    for (const relative of ["lib/index.js", "lib/database.js", "package.json", "LICENSE", "build/Release/better_sqlite3.node"]) expect(filter(path.join(root, prefix, relative), file)).toBe(true)
    for (const relative of ["deps/sqlite3/sqlite3.c", "src/better_sqlite3.cpp", "binding.gyp", "build/Release/obj/gen/sqlite3/sqlite3.c", "build/Release/obj.target/sqlite3/sqlite3.o", "build/Release/sqlite3.a", "build/Release/sqlite3.lib", "build/Release/test_extension.node", "build/Makefile", "build/config.gypi", "build/Release/.deps/better_sqlite3.node.d"]) expect(filter(path.join(root, prefix, relative), file), `${windows ? "Windows" : "normal"}: ${relative}`).toBe(false)
  }
})

it("runs SQLite transactions and persistence from a filtered copy using its normal addon loader", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "vessel-filtered-sqlite-"))
  try {
    const source = path.dirname(require.resolve("better-sqlite3/package.json"))
    const destination = path.join(temp, "node_modules/better-sqlite3")
    const filter = matcher(root, ["**/*", ...sqliteExclusions])
    await cp(source, destination, { recursive: true, filter: async file => {
      const relative = path.relative(source, file)
      if (relative.split(path.sep).includes("node_modules")) return false
      return filter(path.join(root, "node_modules/better-sqlite3", relative), await lstat(file))
    } })
    const dependencies = require(path.join(source, "package.json")).dependencies
    for (const name of Object.keys(dependencies)) {
      const from = path.dirname(require.resolve(`${name}/package.json`, { paths: [source] }))
      const to = path.join(temp, "node_modules", name)
      await mkdir(path.dirname(to), { recursive: true })
      await symlink(from, to, "junction")
    }
    expect(await readdir(path.join(destination, "build/Release"))).toContain("better_sqlite3.node")
    for (const removed of ["src", "deps", "build/Release/obj", "build/Release/obj.target", "build/Release/.deps"]) await expect(lstat(path.join(destination, removed))).rejects.toMatchObject({ code: "ENOENT" })
    const Database = require(destination)
    const file = path.join(temp, "test.sqlite")
    const db = new Database(file)
    db.exec("CREATE TABLE items (value TEXT)")
    db.transaction(() => db.prepare("INSERT INTO items VALUES (?)").run("裁剪后正常读写"))()
    db.close()
    const reopened = new Database(file)
    expect(reopened.prepare("SELECT value FROM items").get()).toEqual({ value: "裁剪后正常读写" })
    reopened.close()
  } finally { await rm(temp, { recursive: true, force: true }) }
})


it("retains the Office loader's English fallback for removed UI languages", async () => {
  const { parseExpressionAt } = createRequire(require.resolve("eslint"))("acorn")
  for (const editor of ["documenteditor", "spreadsheeteditor", "presentationeditor", "pdfeditor", "visioeditor"]) {
    const source = await readFile(`resources/office/v9.3.0.24-1/web-apps/apps/${editor}/main/app.js`, "utf8")
    const start = source.indexOf("new function", source.indexOf("Common.Locale="))
    let expression = parseExpressionAt(source, start, { ecmaVersion: "latest" })
    if (expression.type === "SequenceExpression") expression = expression.expressions[0]
    const requests: string[] = []
    const fetch = async (url: string) => {
      requests.push(url)
      return { ok: url === "locale/en.json", json: async () => ({}) }
    }
    const locale = runInNewContext(source.slice(start, expression.end), {
      window: { fetch }, fetch, console, setTimeout,
      location: { search: "?lang=fr" },
      document: { body: { classList: { contains: () => false } } }
    })
    for (let attempt = 0; attempt < 20 && !requests.includes("locale/en.json"); attempt++) await new Promise(resolve => setTimeout(resolve, 5))
    expect(requests, editor).toEqual(["locale/fr.json", "locale/en.json"])
    expect(locale.getCurrentLanguage()).toBe("en")
  }
})
