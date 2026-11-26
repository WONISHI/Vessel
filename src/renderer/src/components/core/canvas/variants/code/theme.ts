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
  const palettes = [
    { name: "vessel-github-light", base: "vs" as const, background: "#FFFFFF", foreground: "#24292F", comment: "6E7781", keyword: "CF222E", string: "0A3069", number: "0550AE", tag: "116329", attribute: "0550AE", line: "#F6F8FA", selection: "#0969DA33", guide: "#D0D7DE", widget: "#F6F8FA" },
    { name: "vessel-nord-light", base: "vs" as const, background: "#ECEFF4", foreground: "#2E3440", comment: "667185", keyword: "5E81AC", string: "557245", number: "87668D", tag: "5E81AC", attribute: "39727F", line: "#E5E9F0", selection: "#88C0D055", guide: "#D8DEE9", widget: "#E5E9F0" },
    { name: "vessel-nord", base: "vs-dark" as const, background: "#2E3440", foreground: "#D8DEE9", comment: "7B88A1", keyword: "81A1C1", string: "A3BE8C", number: "B48EAD", tag: "81A1C1", attribute: "8FBCBB", line: "#3B4252", selection: "#434C5ECC", guide: "#4C566A", widget: "#3B4252" }
  ]
  for (const palette of palettes) monaco.editor.defineTheme(palette.name, {
    base: palette.base, inherit: true,
    rules: [
      { token: "comment", foreground: palette.comment },
      { token: "keyword", foreground: palette.keyword },
      { token: "string", foreground: palette.string },
      { token: "number", foreground: palette.number },
      { token: "tag", foreground: palette.tag },
      ...["attribute.name", "attribute.name.html", "attribute.name.xml"].map(token => ({ token, foreground: palette.attribute })),
      ...["attribute.value", "attribute.value.html", "attribute.value.xml"].map(token => ({ token, foreground: palette.string }))
    ],
    colors: {
      "editor.background": palette.background, "editor.foreground": palette.foreground,
      "editorGutter.background": palette.background, "minimap.background": palette.background,
      "editorLineNumber.foreground": `#${palette.comment}`, "editorLineNumber.activeForeground": palette.foreground,
      "editor.lineHighlightBackground": palette.line, "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": palette.selection, "editor.inactiveSelectionBackground": palette.selection,
      "editorCursor.foreground": palette.foreground, "editorWhitespace.foreground": palette.guide,
      "editorIndentGuide.background1": palette.guide, "editorIndentGuide.activeBackground1": `#${palette.comment}`,
      "editorWidget.background": palette.widget, "editorWidget.border": palette.guide,
      "editorSuggestWidget.background": palette.widget, "editorSuggestWidget.border": palette.guide,
      "editorHoverWidget.background": palette.widget, "editorHoverWidget.border": palette.guide,
      "scrollbarSlider.background": `${palette.guide}88`, "scrollbarSlider.hoverBackground": palette.guide
    }
  })

}
