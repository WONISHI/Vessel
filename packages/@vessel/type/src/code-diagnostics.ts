export interface CodeDiagnostic {
  message: string
  code: number
  severity: "error" | "warning" | "info"
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}
