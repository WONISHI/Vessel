import "@/components/core/canvas/variants/code/monaco"
import { registerMonacoTheme } from "@/components/core/canvas/variants/code/theme"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import Editor from "@monaco-editor/react"

import { transitTextLanguage } from "./text-language"

export function TransitTextPreview({ content }: { content: string }) {
  const dark = useDarkAppearance()
  return <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
    <Editor height="100%" value={content} language={transitTextLanguage(content)} theme={dark ? "vessel-dark" : "light"} beforeMount={registerMonacoTheme}
      options={{ readOnly: true, domReadOnly: true, automaticLayout: true, minimap: { enabled: false }, fontSize: 12, lineHeight: 19, tabSize: 2, wordWrap: "on", scrollBeyondLastLine: false, padding: { top: 12 }, ariaLabel: "中转站文本预览" }} />
  </div>
}
