import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { fileIconNames, fileIconURL, resolveFileIcon } from "@/features/file-icons/resolve"
import catppuccin from "@/features/file-icons/catppuccin.json"
import symbols from "@/features/file-icons/symbols.json"

describe("complete offline file icon themes", () => {
  it("contains every shipped SVG and resolves every association across all palettes", () => {
    for (const [id, theme, count, palettes] of [["catppuccin", catppuccin, 3280, ["latte", "frappe", "macchiato", "mocha", "css-variables"]], ["symbols", symbols, 371, [""]]] as const) {
      const files = JSON.parse(gunzipSync(readFileSync(`resources/file-icons/${id}.json.gz`)).toString()) as Record<string, string>
      expect(Object.keys(files)).toHaveLength(count)
      for (const definition of Object.values(theme.iconDefinitions)) for (const palette of palettes) {
        const path = `${palette ? palette + "/" : ""}${definition.iconPath}`
        expect(files[path], path).toContain("<svg")
      }
      for (const name of ["fileNames", "fileExtensions", "languageIds", "folderNames", "folderNamesExpanded"] as const) {
        const associations = (theme as Record<string, unknown>)[name] as Record<string, string> | undefined
        for (const icon of Object.values(associations || {})) expect(theme.iconDefinitions).toHaveProperty(icon)
      }
      expect(readFileSync(`resources/file-icons/${id}.LICENSE`, "utf8")).toContain("MIT")
    }
    expect(fileIconNames("catppuccin")).toHaveLength(656)
    expect(fileIconNames("symbols")).toHaveLength(371)
  })
  it("uses exact names, compound extensions, folder names and expanded variants", () => {
    expect(resolveFileIcon("catppuccin", "/project/PACKAGE.JSON")).toBe("package-json")
    expect(resolveFileIcon("catppuccin", "types/example.d.ts")).toBe("typescript-def")
    expect(resolveFileIcon("symbols", "types/example.d.ts")).toBe("ts-types")
    expect(resolveFileIcon("catppuccin", "docs/README.md")).toBe("readme")
    expect(resolveFileIcon("catppuccin", "/project/src", { directory: true, expanded: true })).toBe("folder_src_open")
    expect(resolveFileIcon("catppuccin", "C:\\project\\src", { directory: true })).toBe("folder_src")
    expect(resolveFileIcon("symbols", "unknown-folder", { directory: true, expanded: true })).toBe("folder-open")
    expect(resolveFileIcon("catppuccin", "unknown.randomsuffix")).toBe("_file")
    expect(resolveFileIcon("default", "App.vue")).toBeUndefined()
  })
  it("uses local asset URLs and follows dark/light appearance for automatic palettes", () => {
    expect(fileIconURL("catppuccin", "vue", "auto", false)).toContain("/catppuccin/latte/vue.svg")
    expect(fileIconURL("catppuccin", "vue", "auto", true)).toContain("/catppuccin/mocha/vue.svg")
    expect(fileIconURL("catppuccin", "vue", "frappe", true)).toContain("/catppuccin/frappe/vue.svg")
    expect(fileIconURL("symbols", "document")).toContain("/symbols/files/")
    expect(fileIconURL("symbols", "nonexistent")).toBeUndefined()
  })
})
