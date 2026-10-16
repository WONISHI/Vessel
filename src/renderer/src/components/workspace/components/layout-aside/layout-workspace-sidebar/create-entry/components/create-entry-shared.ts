export interface EntryDraft {
  parent: string
  kind: "file" | "directory"
  extension: string
}
