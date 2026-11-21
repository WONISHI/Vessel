declare module "monaco-editor/esm/vs/language/json/tokenization.js" {
  import type { languages } from "monaco-editor"
  export function createTokenizationSupport(supportComments: boolean): languages.TokensProvider
}
