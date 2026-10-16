export interface ContentSearchOptions {
  root: string
  query: string
  caseSensitive?: boolean
  wholeWord?: boolean
  regex?: boolean
  include?: string
  exclude?: string
  includeIgnored?: boolean
}

export interface ContentMatch {
  path: string
  relativePath: string
  line: number
  column: number
  text: string
  ranges: { start: number; end: number }[]
}

export interface ContentSearchResult {
  matches: ContentMatch[]
  truncated: boolean
}
