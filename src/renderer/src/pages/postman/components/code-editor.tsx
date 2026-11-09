import "@/components/core/canvas/variants/code/monaco"
import { registerMonacoTheme } from "@/components/core/canvas/variants/code/theme"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react"

const PM_TYPINGS = `
interface PmHeaders { add(h: { key: string; value: string }): void; upsert(h: { key: string; value: string }): void; remove(key: string): void; get(key: string): string | undefined; has(key: string): boolean; toObject(): Record<string, string> }
interface PmVariables { get(key: string): string | undefined; set(key: string, value: unknown): void; unset(key: string): void; has(key: string): boolean; toObject(): Record<string, string>; replaceIn(template: string): string }
interface PmExpect { to: PmExpect; be: PmExpect; have: PmExpect; not: PmExpect; deep: PmExpect; and: PmExpect; equal(v: unknown): void; eql(v: unknown): void; include(v: unknown): void; property(k: string, v?: unknown): void; lengthOf(n: number): void; below(n: number): void; above(n: number): void; oneOf(list: unknown[]): void; a(type: string): void; an(type: string): void; readonly true: void; readonly false: void; readonly ok: void; readonly null: void; readonly undefined: void; readonly empty: void }
declare const pm: {
  environment: PmVariables
  variables: PmVariables
  request: { method: string; url: string; headers: PmHeaders }
  response: { code: number; status: string; responseTime: number; headers: PmHeaders; text(): string; json(): any; to: { have: { status(code: number | string): void; header(name: string): void }; be: { readonly ok: boolean } } }
  test(name: string, fn: () => void): void
  expect(value: unknown): PmExpect
}
`

let typingsAdded = false

/** Registers the shared theme plus `pm.*` typings for script editors. */
function beforeMount(monaco: Monaco) {
  registerMonacoTheme(monaco)
  if (typingsAdded) return
  typingsAdded = true
  const defaults = (monaco.languages as unknown as { typescript?: { javascriptDefaults?: { addExtraLib(content: string, path: string): void } } }).typescript?.javascriptDefaults
  defaults?.addExtraLib(PM_TYPINGS, "ts:vessel-api-pm.d.ts")
}

/** Monaco editor configured for the API page (request bodies, scripts and responses). */
export function ApiCodeEditor({ value, onChange, language, readOnly, ariaLabel, onMount, wordWrap = true }: { value: string; onChange?: (value: string) => void; language: string; readOnly?: boolean; ariaLabel: string; onMount?: OnMount; wordWrap?: boolean }) {
  const dark = useDarkAppearance()
  return (
    <Editor
      height="100%"
      theme={dark ? "vessel-dark" : "light"}
      beforeMount={beforeMount}
      onMount={onMount}
      language={language}
      value={value}
      onChange={(next) => onChange?.(next ?? "")}
      options={{ readOnly, domReadOnly: readOnly, automaticLayout: true, minimap: { enabled: false }, fontSize: 12, tabSize: 2, wordWrap: wordWrap ? "on" : "off", scrollBeyondLastLine: false, ariaLabel, padding: { top: 8 }, fixedOverflowWidgets: true }}
    />
  )
}
