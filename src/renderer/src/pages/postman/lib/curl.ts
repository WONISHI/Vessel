import { emptyAuth, newDraft, type KV, type RequestDraft } from "@/pages/postman/lib/model"
import { paramsFromUrl, splitUrl } from "@/pages/postman/lib/url-params"

/** Shell-style tokenizer: single/double quotes, $'…' ANSI-C quotes, backslash escapes and line continuations. */
export function tokenizeShell(input: string): string[] {
  const tokens: string[] = []
  let current = ""
  let started = false
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (char === "\\" && (input[i + 1] === "\n" || (input[i + 1] === "\r" && input[i + 2] === "\n"))) {
      i += input[i + 1] === "\r" ? 2 : 1
      continue
    }
    if (/\s/.test(char)) {
      if (started) tokens.push(current)
      current = ""
      started = false
      continue
    }
    started = true
    if (char === "'") {
      const end = input.indexOf("'", i + 1)
      current += input.slice(i + 1, end === -1 ? undefined : end)
      i = end === -1 ? input.length : end
    } else if (char === "$" && input[i + 1] === "'") {
      let j = i + 2
      for (; j < input.length && input[j] !== "'"; j++) {
        if (input[j] === "\\" && j + 1 < input.length) {
          const next = input[++j]
          current += next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "\r" : next
        } else current += input[j]
      }
      i = j
    } else if (char === '"') {
      let j = i + 1
      for (; j < input.length && input[j] !== '"'; j++) {
        if (input[j] === "\\" && /["\\$`\n]/.test(input[j + 1] ?? "")) current += input[++j]
        else current += input[j]
      }
      i = j
    } else if (char === "\\" && i + 1 < input.length) current += input[++i]
    else current += char
  }
  if (started) tokens.push(current)
  return tokens
}

const splitPair = (text: string, separator: string): [string, string] => {
  const index = text.indexOf(separator)
  return index === -1 ? [text.trim(), ""] : [text.slice(0, index).trim(), text.slice(index + separator.length).trim()]
}

/** Parses a `curl …` command (as copied from browser devtools) into a request draft. */
export function parseCurl(command: string): RequestDraft {
  const tokens = tokenizeShell(command.trim())
  if (tokens[0]?.toLowerCase() !== "curl") throw new Error("不是有效的 cURL 命令")
  let method = ""
  let url = ""
  let forceGet = false
  const headers: KV[] = []
  const data: string[] = []
  const form: KV[] = []
  const auth = emptyAuth()
  let authType: RequestDraft["authType"] = "none"
  const takesValue = new Set(["-X", "--request", "-H", "--header", "-d", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode", "-F", "--form", "--form-string", "-u", "--user", "--url", "-b", "--cookie", "-A", "--user-agent", "-e", "--referer", "-o", "--output", "-m", "--max-time", "--connect-timeout", "-x", "--proxy", "-w", "--write-out"])
  for (let i = 1; i < tokens.length; i++) {
    let token = tokens[i]
    let value: string | undefined
    const eq = token.startsWith("--") ? token.indexOf("=") : -1
    if (eq > 0 && takesValue.has(token.slice(0, eq))) {
      value = token.slice(eq + 1)
      token = token.slice(0, eq)
    } else if (/^-[XHdFubAe]./.test(token)) {
      value = token.slice(2)
      token = token.slice(0, 2)
    } else if (takesValue.has(token)) value = tokens[++i] ?? ""
    switch (token) {
      case "-X": case "--request": method = value!.toUpperCase(); break
      case "-H": case "--header": {
        const [key, headerValue] = splitPair(value!, ":")
        if (key) headers.push({ key, value: headerValue, enabled: true })
        break
      }
      case "-d": case "--data": case "--data-raw": case "--data-binary": case "--data-ascii": case "--data-urlencode": data.push(value!); break
      case "-F": case "--form": case "--form-string": {
        const [key, formValue] = splitPair(value!, "=")
        form.push({ key, value: formValue, enabled: true })
        break
      }
      case "-u": case "--user": {
        const [username, password] = splitPair(value!, ":")
        Object.assign(auth, { username, password })
        authType = "basic"
        break
      }
      case "-b": case "--cookie": headers.push({ key: "Cookie", value: value!, enabled: true }); break
      case "-A": case "--user-agent": headers.push({ key: "User-Agent", value: value!, enabled: true }); break
      case "-e": case "--referer": headers.push({ key: "Referer", value: value!, enabled: true }); break
      case "--url": url = value!; break
      case "-G": case "--get": forceGet = true; break
      case "-I": case "--head": method = "HEAD"; break
      default:
        if (value === undefined && !token.startsWith("-") && !url) url = token
    }
  }
  if (!url) throw new Error("cURL 命令缺少 URL")
  const contentType = headers.find((h) => h.key.toLowerCase() === "content-type")?.value.toLowerCase() ?? ""
  const body = data.join("&")
  const draft = newDraft({ headers, auth, authType })
  if (forceGet && body) {
    url += `${splitUrl(url).query === null ? "?" : "&"}${body}`
  } else if (form.length) {
    Object.assign(draft, { bodyType: "form-data", bodyForm: form })
  } else if (data.length) {
    const looksJson = /^\s*[[{]/.test(body)
    if (contentType.includes("json") || (!contentType && looksJson)) Object.assign(draft, { bodyType: "raw", rawType: "json", bodyRaw: (() => { try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body } })() })
    else if (contentType.includes("x-www-form-urlencoded") || (!contentType && !looksJson)) {
      const fields = body.split("&").filter(Boolean).map((pair) => { const [key, fieldValue] = splitPair(pair, "="); return { key: safeDecode(key), value: safeDecode(fieldValue), enabled: true } })
      Object.assign(draft, { bodyType: "x-www-form-urlencoded", bodyForm: fields })
    } else Object.assign(draft, { bodyType: "raw", rawType: contentType.includes("xml") ? "xml" : contentType.includes("html") ? "html" : "text", bodyRaw: body })
  }
  draft.method = method || (forceGet ? "GET" : data.length || form.length ? "POST" : "GET")
  draft.url = url
  draft.params = paramsFromUrl(url, [])
  try { draft.name = `${draft.method} ${new URL(url).pathname}` } catch { draft.name = "cURL 导入" }
  return draft
}

function safeDecode(text: string) {
  try { return decodeURIComponent(text.replace(/\+/g, " ")) } catch { return text }
}
