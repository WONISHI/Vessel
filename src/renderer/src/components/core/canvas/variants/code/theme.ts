import type { Monaco } from "@monaco-editor/react"

/** Registers the shared Monaco palette before an editor is created. */
export function registerMonacoTheme(monaco: Monaco) {
  monaco.editor.defineTheme("vessel-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "768390" },
      { token: "keyword", foreground: "F47067" },
      { token: "string", foreground: "96D0FF" },
      { token: "number", foreground: "6CB6FF" }
    ],
    colors: {
      "editor.background": "#22272E",
      "editor.foreground": "#CDD9E5",
      "editorGutter.background": "#22272E",
      "editorLineNumber.foreground": "#768390",
      "editorLineNumber.activeForeground": "#CDD9E5",
      "editor.lineHighlightBackground": "#2D333B",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#316DCA66",
      "editor.inactiveSelectionBackground": "#316DCA33",
      "editorCursor.foreground": "#CDD9E5",
      "editorWhitespace.foreground": "#444C56",
      "editorIndentGuide.background1": "#444C56",
      "editorIndentGuide.activeBackground1": "#768390",
      "editorWidget.background": "#2D333B",
      "editorWidget.border": "#444C56",
      "editorSuggestWidget.background": "#2D333B",
      "editorSuggestWidget.border": "#444C56",
      "editorHoverWidget.background": "#2D333B",
      "editorHoverWidget.border": "#444C56",
      "scrollbarSlider.background": "#444C56",
      "scrollbarSlider.hoverBackground": "#57606A",
      "scrollbarSlider.activeBackground": "#768390",
      "minimap.background": "#22272E"
    }
  })
}
