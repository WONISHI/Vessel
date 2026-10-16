export type ClipMode = "article" | "selection" | "bookmark"

export interface PageMetadata {
  title: string
  url: string
  description?: string
  author?: string
  siteName?: string
  favicon?: string
  selectedText?: string
  selectedHtml?: string
  articleHtml?: string
  articleText?: string
  timestamp?: string
}

export interface ClipPayload {
  title: string
  url: string
  markdown: string
  tags?: string[]
  folder?: string
  author?: string
  description?: string
  timestamp?: string
  mode?: ClipMode
}

export interface ClipResponse {
  ok: boolean
  success?: boolean
  message?: string
  filename?: string
  relativePath?: string
  path?: string
  error?: string
}

export interface VesselAppStatus {
  ok: boolean
  app: string
  version: string
  workspace: {
    path: string
    name: string
  } | null
}
