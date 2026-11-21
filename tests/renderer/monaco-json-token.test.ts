import { afterEach, expect, it, vi } from "vitest"
import { registerJsonHighlighting } from "@/components/core/canvas/variants/code/json-highlighting"
import { codeLanguage, ensureCodeModelLanguage } from "@/components/core/canvas/variants/code/language"
afterEach(() => vi.unstubAllGlobals())

it("tokenizes JSON properties, values, numbers and booleans", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  document.queryCommandSupported = vi.fn(() => false)
  const monaco = await import("monaco-editor")
  monaco.json.jsonDefaults.setModeConfiguration({ ...monaco.json.jsonDefaults.modeConfiguration, diagnostics: false })
  const highlighting = registerJsonHighlighting(monaco)
  const model = monaco.editor.createModel('{ "name": "Vessel", "tabWidth": 2, "semi": false }', "plaintext")
  try {
    expect(codeLanguage("/repo/.prettierrc.json")).toBe("json")
    ensureCodeModelLanguage(monaco, model, "/repo/.prettierrc.json")
    expect(model.getLanguageId()).toBe("json")
    // Colors are available synchronously, without waiting for jsonMode's import.
      const tokens = monaco.editor.tokenize(model.getValue(), model.getLanguageId())[0].map(token => token.type)
      expect(tokens).toContain("string.key.json")
      expect(tokens).toContain("string.value.json")
      expect(tokens).toContain("number.json")
      expect(tokens).toContain("keyword.json")
    const colored = await monaco.editor.colorize(model.getValue(), "json", {})
    expect(new Set(colored.match(/mtk\d+/g)).size).toBeGreaterThan(3)
    ensureCodeModelLanguage(monaco, model, "/repo/config.jsonc")
    expect(monaco.editor.tokenize('// comment\n{"name":"Vessel"}', model.getLanguageId())[0][0].type).toBe("comment.line.json")
    // Let Monaco's independently scheduled language-service import finish before teardown.
    await monaco.json.getWorker()
  } finally { model.dispose(); highlighting.dispose(); vi.unstubAllGlobals() }
}, 15000)
