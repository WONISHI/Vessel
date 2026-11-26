export interface CodeDiagnostic {
  message: string
  code: number
  severity: "error" | "warning" | "info"
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

export interface CodeDefinitionRequest {
  path: string
  content: string
  offset: number
}

export interface CodeDefinition {
  path: string
  lineNumber: number
  column: number
  endLineNumber: number
  endColumn: number
}
