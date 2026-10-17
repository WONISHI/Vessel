import type { BaseFile, BaseValue } from "#vessel-obsidian/bases/types"

type Node = { kind: "literal"; value: BaseValue } | { kind: "id"; name: string } | { kind: "member"; object: Node; key: Node } | { kind: "call"; target: Node; args: Node[] } | { kind: "unary"; op: string; value: Node } | { kind: "binary"; op: string; left: Node; right: Node }
const precedence: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "!=": 3, ">": 4, "<": 4, ">=": 4, "<=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6 }
const forbidden = new Set(["__proto__", "prototype", "constructor"])
export interface BaseExpressionContext {
  file: BaseFile
  base: BaseFile
  formula: (name: string) => BaseValue
}

/** Parses the supported Bases expression grammar without eval, Function or JavaScript property execution. */
export function compileBaseExpression(source: string): (context: BaseExpressionContext) => BaseValue {
  if (source.length > 16384) throw new Error("Base 表达式过长")
  const tokens = source.match(/\s+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:\d+(?:\.\d+)?|\.\d+)|[\p{L}_$][\p{L}\p{N}_$]*|==|!=|>=|<=|&&|\|\||[().,\[\]+*/%<>!\-]|./gu)?.filter((token) => !/^\s+$/.test(token)) || []
  if (tokens.length > 2048) throw new Error("Base 表达式过于复杂")
  let position = 0

  /** Consumes one required syntax token. */
  const expect = (token: string) => {
    if (tokens[position++] !== token) throw new Error(`表达式缺少 ${token}：${source}`)
  }

  /** Parses a precedence-aware expression and its member/call suffixes. */
  const parse = (minimum = 0, depth = 0): Node => {
    if (depth > 64) throw new Error("Base 表达式嵌套过深")
    const token = tokens[position++]
    let node: Node
    if (token === "(") {
      node = parse(0, depth + 1)
      expect(")")
    } else if (["!", "-", "+"].includes(token)) node = { kind: "unary", op: token, value: parse(7, depth + 1) }
    else if (token?.startsWith('"') || token?.startsWith("'")) {
      const quote = token[0]
      if (!token.endsWith(quote) || token.length < 2) throw new Error("字符串引号未闭合")
      const value = quote === '"' ? JSON.parse(token) : token.slice(1, -1).replace(/\\(['\\])/g, "$1")
      node = { kind: "literal", value }
    } else if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(token || "")) node = { kind: "literal", value: Number(token) }
    else if (["true", "false", "null"].includes(token)) node = { kind: "literal", value: token === "null" ? null : token === "true" }
    else if (/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(token || "")) node = { kind: "id", name: token }
    else throw new Error(`不支持的 Base 表达式：${source}`)
    while (position < tokens.length) {
      const next = tokens[position]
      if (next === ".") {
        position++
        const key = tokens[position++]
        if (!/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(key || "")) throw new Error("属性名无效")
        node = { kind: "member", object: node, key: { kind: "literal", value: key } }
        continue
      }
      if (next === "[") {
        position++
        const key = parse(0, depth + 1)
        expect("]")
        node = { kind: "member", object: node, key }
        continue
      }
      if (next === "(") {
        position++
        const args: Node[] = []
        if (tokens[position] !== ")") {
          do {
            args.push(parse(0, depth + 1))
            if (tokens[position] !== ",") break
            position++
          } while (position < tokens.length)
        }
        expect(")")
        node = { kind: "call", target: node, args }
        continue
      }
      const rank = Object.hasOwn(precedence, next) ? precedence[next] : -1
      if (rank < minimum) break
      position++
      node = { kind: "binary", op: next, left: node, right: parse(rank + 1, depth + 1) }
    }
    return node
  }
  const tree = parse()
  if (position !== tokens.length) throw new Error(`不支持的 Base 表达式语法：${source}`)
  return (context) => evaluate(tree, context)
}

/** Retrieves data-only properties, never inherited JavaScript methods. */
function property(value: unknown, key: string): BaseValue {
  if (forbidden.has(key)) throw new Error(`不允许访问属性 ${key}`)
  if ((Array.isArray(value) || typeof value === "string") && key === "length") return value.length
  if (value && typeof value === "object" && Object.hasOwn(value, key)) return (value as Record<string, BaseValue>)[key] ?? null
  return null
}

/** Rejects unsupported numeric coercions, including unimplemented date-duration arithmetic. */
function numeric(value: BaseValue): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("此算术表达式需要数字；日期时长运算暂不支持")
  return value
}

/** Evaluates a parsed expression using a fixed collection of Bases operations. */
function evaluate(node: Node, context: BaseExpressionContext): BaseValue {
  if (node.kind === "literal") return node.value
  if (node.kind === "id") {
    if (node.name === "file") return context.file.file
    if (node.name === "note") return context.file.properties
    if (node.name === "this") return { ...context.base.properties, file: context.base.file }
    return property(context.file.properties, node.name)
  }
  if (node.kind === "member") {
    const key = String(evaluate(node.key, context))
    if (forbidden.has(key)) throw new Error(`不允许访问属性 ${key}`)
    if (node.object.kind === "id" && node.object.name === "formula") return context.formula(key)
    return property(evaluate(node.object, context), key)
  }
  if (node.kind === "unary") {
    const value = evaluate(node.value, context)
    return node.op === "!" ? !value : node.op === "-" ? -numeric(value) : numeric(value)
  }
  if (node.kind === "binary") {
    const a = evaluate(node.left, context)
    if (node.op === "&&") return a ? evaluate(node.right, context) : a
    if (node.op === "||") return a || evaluate(node.right, context)
    const b = evaluate(node.right, context)
    switch (node.op) {
      case "==":
        return a === b
      case "!=":
        return a !== b
      case ">":
        return a !== null && b !== null && (a as string | number) > (b as string | number)
      case "<":
        return a !== null && b !== null && (a as string | number) < (b as string | number)
      case ">=":
        return a !== null && b !== null && (a as string | number) >= (b as string | number)
      case "<=":
        return a !== null && b !== null && (a as string | number) <= (b as string | number)
      case "+":
        if (typeof a === "number" && typeof b === "string" && /^\s*\d+\s*(?:years?|months?|weeks?|days?|hours?|minutes?|seconds?|[yMwdhms])\s*$/.test(b)) throw new Error("日期时长运算暂不支持")
        return typeof a === "string" || typeof b === "string" ? String(a ?? "") + String(b ?? "") : numeric(a) + numeric(b)
      case "-":
        return numeric(a) - numeric(b)
      case "*":
        return numeric(a) * numeric(b)
      case "/":
        return numeric(b) === 0 ? null : numeric(a) / numeric(b)
      case "%":
        return numeric(b) === 0 ? null : numeric(a) % numeric(b)
    }
  }
  if (node.kind === "call") {
    if (node.target.kind === "id" && node.target.name === "if") return evaluate(node.args[0], context) ? (node.args[1] ? evaluate(node.args[1], context) : null) : node.args[2] ? evaluate(node.args[2], context) : null
    const args = node.args.map((argument) => evaluate(argument, context))
    if (node.target.kind === "id") {
      switch (node.target.name) {
        case "list":
          return args
        case "link":
          return String(args[1] ?? args[0] ?? "")
        case "number": {
          const number = Number(args[0])
          if (!Number.isFinite(number)) throw new Error("无法转换为数字")
          return number
        }
        case "string":
          return String(args[0] ?? "")
        case "date": {
          const time = Date.parse(String(args[0]))
          if (!Number.isFinite(time)) throw new Error("日期格式错误")
          return time
        }
        case "now":
          return Date.now()
        case "today":
          return new Date().setHours(0, 0, 0, 0)
        case "min":
          return Math.min(...args.map(numeric))
        case "max":
          return Math.max(...args.map(numeric))
      }
    }
    if (node.target.kind === "member") {
      const receiver = evaluate(node.target.object, context),
        method = String(evaluate(node.target.key, context))
      if (receiver === context.file.file || receiver === context.base.file) {
        const file = receiver as unknown as BaseFile["file"],
          value = String(args[0] ?? "").replace(/^#/, "")
        if (method === "inFolder") {
          const folder = value.replace(/^(?:\.\/)+/, "").replace(/^\/+|\/+$/g, "")
          return !folder || file.folder === folder || file.folder.startsWith(folder + "/")
        }
        if (method === "hasProperty") return Object.hasOwn(file.properties, value)
        if (method === "hasTag") return file.tags.some((tag) => tag === value || tag.startsWith(value + "/"))
        if (method === "hasLink") return file.links.some((link) => link === value || link.replace(/\.md$/i, "") === value.replace(/\.md$/i, ""))
        if (method === "asLink") return String(args[0] ?? file.name)
      }
      if (method === "contains" && (typeof receiver === "string" || Array.isArray(receiver))) return receiver.includes(args[0] as never)
      if (method === "startsWith" && typeof receiver === "string") return receiver.startsWith(String(args[0] ?? ""))
      if (method === "endsWith" && typeof receiver === "string") return receiver.endsWith(String(args[0] ?? ""))
      if (method === "isEmpty") return receiver === null || receiver === "" || (Array.isArray(receiver) && !receiver.length)
      if (method === "lower" || method === "toLowerCase") return String(receiver ?? "").toLowerCase()
      if (method === "upper" || method === "toUpperCase") return String(receiver ?? "").toUpperCase()
      if (method === "toString") return String(receiver ?? "")
      if (method === "toFixed" && typeof receiver === "number") return receiver.toFixed(Math.max(0, Math.min(20, Number(args[0] ?? 0))))
      if (method === "round" && typeof receiver === "number") {
        const scale = 10 ** Math.max(0, Math.min(12, Number(args[0] ?? 0)))
        return Math.round(receiver * scale) / scale
      }
      if (method === "join" && Array.isArray(receiver)) return receiver.join(String(args[0] ?? ","))
    }
    throw new Error("暂不支持此 Base 函数")
  }
  throw new Error("Base 表达式无效")
}
