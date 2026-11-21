import type { Monaco } from "@monaco-editor/react"
import { createTokenizationSupport } from "monaco-editor/esm/vs/language/json/tokenization.js"

/** JSON colors must be ready even before the lazy JSON language service loads. */
export function registerJsonHighlighting(monaco: Monaco) {
  return monaco.languages.setTokensProvider("json", createTokenizationSupport(true))
}
