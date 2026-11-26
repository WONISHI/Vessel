import "@/components/core/canvas/variants/code/monaco"
import { registerMonacoTheme } from "@/components/core/canvas/variants/code/theme"
import { useMonacoTheme } from "@/features/editor-appearance/use-monaco-theme"
import Editor from "@monaco-editor/react"

export default function TableJsonEditor({ value, onChange, readOnly }: { value: string; onChange: (value: string) => void; readOnly: boolean }) {
  const editorTheme = useMonacoTheme()
  return <Editor language="json" value={value} onChange={(text) => onChange(text ?? "")} height="360px"
    theme={editorTheme} beforeMount={registerMonacoTheme}
    options={{ readOnly, automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false,
      fontSize: 13, tabSize: 2, wordWrap: "on", formatOnPaste: true, formatOnType: true, padding: { top: 12, bottom: 12 } }} />
}
