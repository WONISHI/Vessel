import type { ApiTestResult } from "@vessel/type/api-client"
import { runInNewContext } from "node:vm"

export interface ScriptRequest {
  method: string
  url: string
  headers: Record<string, string>
}

export interface ScriptResponse {
  code: number
  status: string
  responseTime: number
  headers: Record<string, string>
  body: string
}

export interface ScriptOutcome {
  tests: ApiTestResult[]
  logs: string[]
  error?: string
}

const format = (value: unknown) => {
  if (typeof value === "string") return value
  try { return JSON.stringify(value) } catch { return String(value) }
}

/** vm errors come from another realm, so `instanceof Error` is unreliable. */
const messageOf = (error: unknown) => (error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error))

const same = (a: unknown, b: unknown) => a === b || (typeof a === "object" && typeof b === "object" && a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b))

/** Minimal chai-style `expect` covering the assertions Postman snippets use most. */
function createExpect(value: unknown, negate = false): any {
  const assert = (ok: boolean, message: string) => {
    if (ok === negate) throw new Error(negate ? `Expected not: ${message}` : `Expected ${message}`)
  }
  const chain: any = {
    equal: (expected: unknown) => assert(value === expected, `${format(value)} to equal ${format(expected)}`),
    eql: (expected: unknown) => assert(same(value, expected), `${format(value)} to deeply equal ${format(expected)}`),
    include: (expected: unknown) => assert(typeof value === "string" ? value.includes(String(expected)) : Array.isArray(value) ? value.some((item) => same(item, expected)) : false, `${format(value)} to include ${format(expected)}`),
    property: (key: string, expected?: unknown) => assert(value !== null && typeof value === "object" && key in value && (expected === undefined || same((value as Record<string, unknown>)[key], expected)), `${format(value)} to have property ${key}`),
    lengthOf: (length: number) => assert((value as { length?: number })?.length === length, `${format(value)} to have length ${length}`),
    below: (limit: number) => assert((value as number) < limit, `${format(value)} to be below ${limit}`),
    above: (limit: number) => assert((value as number) > limit, `${format(value)} to be above ${limit}`),
    oneOf: (list: unknown[]) => assert(list.some((item) => same(item, value)), `${format(value)} to be one of ${format(list)}`),
    a: (type: string) => assert((Array.isArray(value) ? "array" : value === null ? "null" : typeof value) === type.toLowerCase(), `${format(value)} to be a ${type}`)
  }
  chain.an = chain.a
  chain.contain = chain.include
  chain.eq = chain.equal
  Object.defineProperties(chain, {
    true: { get: () => assert(value === true, `${format(value)} to be true`) },
    false: { get: () => assert(value === false, `${format(value)} to be false`) },
    ok: { get: () => assert(Boolean(value), `${format(value)} to be truthy`) },
    null: { get: () => assert(value === null, `${format(value)} to be null`) },
    undefined: { get: () => assert(value === undefined, `${format(value)} to be undefined`) },
    empty: { get: () => assert(value === "" || (Array.isArray(value) && value.length === 0) || (!!value && typeof value === "object" && Object.keys(value).length === 0), `${format(value)} to be empty`) },
    not: { get: () => createExpect(value, !negate) }
  })
  for (const word of ["to", "be", "been", "is", "that", "which", "and", "has", "have", "with", "deep"]) Object.defineProperty(chain, word, { get: () => chain })
  return chain
}

/** Mutable header bag exposed as pm.request.headers. */
function headerApi(headers: Record<string, string>) {
  const find = (key: string) => Object.keys(headers).find((name) => name.toLowerCase() === key.toLowerCase())
  return {
    add: ({ key, value }: { key: string; value: string }) => { headers[key] = String(value) },
    upsert: ({ key, value }: { key: string; value: string }) => { headers[find(key) ?? key] = String(value) },
    remove: (key: string) => { const name = find(key); if (name) delete headers[name] },
    get: (key: string) => { const name = find(key); return name ? headers[name] : undefined },
    has: (key: string) => !!find(key),
    toObject: () => ({ ...headers })
  }
}

/**
 * Runs a Postman-style script (pre-request or tests). `vars` is mutated in place and every change is
 * recorded in `envUpdates` (null = unset). node:vm isolates globals and enforces a timeout; it is not
 * a security boundary, so only the user's own scripts should run here.
 */
export function runApiScript(script: string, { vars, envUpdates, request, response }: { vars: Record<string, string>; envUpdates: Record<string, string | null>; request: ScriptRequest; response?: ScriptResponse }): ScriptOutcome {
  const outcome: ScriptOutcome = { tests: [], logs: [] }
  if (!script.trim()) return outcome
  let json: unknown
  let parsed = false
  const environment = {
    get: (key: string) => vars[key],
    set: (key: string, value: unknown) => { vars[key] = String(value); envUpdates[key] = String(value) },
    unset: (key: string) => { delete vars[key]; envUpdates[key] = null },
    has: (key: string) => key in vars,
    toObject: () => ({ ...vars }),
    replaceIn: (template: string) => template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => vars[key] ?? match)
  }
  const log = (level: string) => (...args: unknown[]) => outcome.logs.push(`${level === "log" ? "" : `[${level}] `}${args.map(format).join(" ")}`)
  const pm: Record<string, unknown> = {
    environment,
    variables: environment,
    request: {
      get method() { return request.method },
      set method(value: string) { request.method = String(value).toUpperCase() },
      get url() { return request.url },
      set url(value: string) { request.url = String(value) },
      headers: headerApi(request.headers)
    },
    test: (name: string, fn: () => void) => {
      try {
        fn()
        outcome.tests.push({ name, passed: true })
      } catch (error) {
        outcome.tests.push({ name, passed: false, error: messageOf(error) })
      }
    },
    expect: (value: unknown) => createExpect(value)
  }
  if (response) {
    const responseHeaders = headerApi({ ...response.headers })
    pm.response = {
      code: response.code,
      status: response.status,
      responseTime: response.responseTime,
      headers: responseHeaders,
      text: () => response.body,
      json: () => {
        if (!parsed) { json = JSON.parse(response.body); parsed = true }
        return json
      },
      to: {
        have: {
          status: (expected: number | string) => {
            if (typeof expected === "number" ? response.code !== expected : response.status !== expected) throw new Error(`Expected status ${expected} but got ${response.code}`)
          },
          header: (name: string) => { if (!responseHeaders.has(name)) throw new Error(`Expected header ${name}`) }
        },
        be: {
          get ok() { if (response.code < 200 || response.code >= 300) throw new Error(`Expected 2xx but got ${response.code}`); return true }
        }
      }
    }
  }
  try {
    runInNewContext(script, { pm, console: { log: log("log"), info: log("info"), warn: log("warn"), error: log("error") } }, { timeout: 2000 })
  } catch (error) {
    outcome.error = messageOf(error)
  }
  return outcome
}
