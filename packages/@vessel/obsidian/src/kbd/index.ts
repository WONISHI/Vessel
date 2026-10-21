export interface KeyboardShortcut {
  /** Full matched shortcut text in the source, e.g. "shift + Delete", "Ctrl + D", "按键1 + 按键2". */
  raw: string
  /** Individual key names in sequential order, e.g. ["shift", "Delete"]. */
  keys: string[]
  /** 0-based start offset in the source. */
  start: number
  /** 0-based end offset in the source. */
  end: number
}

export interface KeyboardShortcutPart {
  kind: "text" | "shortcut"
  text: string
  keys?: string[]
}

const MODIFIER_KEYS = new Set([
  "ctrl",
  "control",
  "alt",
  "option",
  "opt",
  "shift",
  "cmd",
  "command",
  "win",
  "windows",
  "meta",
  "super",
  "fn",
  "⌘",
  "⌥",
  "⇧",
  "⌃"
])

const SPECIAL_KEYS = new Set([
  "delete",
  "del",
  "backspace",
  "enter",
  "return",
  "tab",
  "esc",
  "escape",
  "space",
  "spacebar",
  "insert",
  "ins",
  "home",
  "end",
  "pageup",
  "pagedown",
  "pgup",
  "pgdn",
  "up",
  "down",
  "left",
  "right",
  "caps",
  "capslock",
  "printscreen",
  "prtscn",
  "pause",
  "break",
  "⎋",
  "⏎",
  "⌫",
  "⇥",
  "↑",
  "↓",
  "←",
  "→"
])

const CHINESE_OR_INDICATOR_PATTERN = /^(?:按键\d*|键\d+|key\d*|控制键|回车|空格|退格|删除|换行|制表符|上|下|左|右|上箭头|下箭头|左箭头|右箭头)$/i

const FUNCTION_KEY_PATTERN = /^f\d{1,2}$/i

/**
 * Checks if a token is a recognized key identifier or modifier.
 */
function isRecognizedKeyToken(token: string): boolean {
  const lower = token.toLowerCase()
  return (
    MODIFIER_KEYS.has(lower) ||
    SPECIAL_KEYS.has(lower) ||
    FUNCTION_KEY_PATTERN.test(lower) ||
    CHINESE_OR_INDICATOR_PATTERN.test(token)
  )
}

/**
 * Checks if a token can be a valid key in a multi-key combination.
 * When combined with recognized keys, single characters, digits, or symbols are accepted.
 */
function isValidKeyPart(token: string): boolean {
  if (isRecognizedKeyToken(token)) return true
  // Single letter, digit, or symbol (e.g. 'D', '1', '+', '-', '/', etc.)
  if (/^[\p{L}\p{N}~!@#$%^&*()_+=/\\|?><,.:;'"\-`]$/u.test(token)) return true
  return false
}

/**
 * Parses keyboard shortcuts formatted as "按键1 + 按键2" with spaces around the keys and plus.
 * Excludes fenced and inline code blocks; preserves source offsets.
 */
export function parseKeyboardShortcuts(source: string): KeyboardShortcut[] {
  if (!source || !source.includes("+")) return []

  const excluded: { start: number; end: number }[] = []
  let fence: { char: string; length: number; start: number } | undefined
  let offset = 0

  for (const line of source.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (
        marker &&
        marker[1][0] === fence.char &&
        marker[1].length >= fence.length &&
        /^\s*$/.test(line.slice(marker[0].length))
      ) {
        excluded.push({ start: fence.start, end: offset + line.length })
        fence = undefined
      }
    } else if (marker) {
      fence = { char: marker[1][0], length: marker[1].length, start: offset }
    } else if (/^(?: {4}|\t)/.test(line)) {
      excluded.push({ start: offset, end: offset + line.length })
    }
    offset += line.length
  }
  if (fence) excluded.push({ start: fence.start, end: source.length })

  for (let i = 0; i < source.length; i++) {
    const block = excluded.find((range) => i >= range.start && i < range.end)
    if (block) {
      i = block.end - 1
      continue
    }
    if (source[i] !== "`") continue
    let length = 1
    while (source[i + length] === "`") length++
    let end = source.indexOf("`".repeat(length), i + length)
    while (end >= 0 && (source[end - 1] === "`" || source[end + length] === "`")) {
      end = source.indexOf("`".repeat(length), end + length)
    }
    if (end >= 0) {
      excluded.push({ start: i, end: end + length })
      i = end + length - 1
    } else {
      i += length - 1
    }
  }

  const results: KeyboardShortcut[] = []
  // Matches Key1 + Key2 (+ Key3...) where "+" has spaces around it
  // and Key1 and KeyN have boundaries/spaces before and after
  const shortcutPattern = /(?:^|(?<=[\s([（【<"“'‘•·*:\-—]))([^\s+]+(?:\s+\+\s+[^\s+]+)+)(?=$|[\s)\]）】>"”'’:,，.。;；!\?！？])/gu

  for (const match of source.matchAll(shortcutPattern)) {
    const raw = match[1]
    const start = match.index!
    const end = start + raw.length

    // Skip if inside code blocks
    if (excluded.some((range) => start < range.end && end > range.start)) continue

    const keys = raw.split(/\s+\+\s+/)
    if (keys.length < 2) continue

    // All tokens must be valid key parts
    if (!keys.every(isValidKeyPart)) continue

    // At least one token must be a recognized key token (not just pure arithmetic like "1 + 2" or "a + b")
    if (!keys.some(isRecognizedKeyToken)) continue

    results.push({
      raw,
      keys,
      start,
      end
    })
  }

  return results
}

/** Alias for parseKeyboardShortcuts */
export const parseKbdShortcuts = parseKeyboardShortcuts

/**
 * Checks whether an entire string is a single valid keyboard shortcut.
 */
export function isKeyboardShortcut(text: string): boolean {
  const trimmed = text.trim()
  const matches = parseKeyboardShortcuts(trimmed)
  return matches.length === 1 && matches[0].raw === trimmed
}

/**
 * Splits source text into plain text parts and keyboard shortcut parts.
 */
export function parseKeyboardShortcutParts(source: string): KeyboardShortcutPart[] {
  const matches = parseKeyboardShortcuts(source)
  if (!matches.length) return [{ kind: "text", text: source }]

  const parts: KeyboardShortcutPart[] = []
  let offset = 0
  for (const match of matches) {
    if (match.start > offset) {
      parts.push({ kind: "text", text: source.slice(offset, match.start) })
    }
    parts.push({ kind: "shortcut", text: match.raw, keys: match.keys })
    offset = match.end
  }
  if (offset < source.length) {
    parts.push({ kind: "text", text: source.slice(offset) })
  }
  return parts
}
