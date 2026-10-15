export type ShortcutItem = {
  label: string
  key: string
  scope: string
  mod?: boolean
  ctrl?: boolean
  shift?: boolean
}

export type ShortcutId =
  | 'command'
  | 'find'
  | 'scrollTop'
  | 'scrollBottom'
  | 'goToLine'
  | 'sidebar'
  | 'devtools'
  | 'refreshBrowser'
  | 'previousTab'
  | 'nextTab'
  | 'save'
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'headings'
  | 'strike'
  | 'link'
  | 'emoji'
  | 'list'
  | 'ordered-list'
  | 'check'
  | 'quote'
  | 'line'
  | 'code'
  | 'inline-code'
  | 'table'
  | 'pinScreenshot'
  | 'copyColor'

export interface KeyInput {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  meta?: boolean
  control?: boolean
  shift?: boolean
  alt?: boolean
  isComposing?: boolean
}
