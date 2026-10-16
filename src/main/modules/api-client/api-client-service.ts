import { type ApiClientStore } from "@main/modules/api-client/store"
import type { ApiResponseData, ApiSendOptions, ApiTestResult } from "@vessel/type/api-client"
export type { ApiResponseData, ApiSendOptions, ApiTestResult } from "@vessel/type/api-client"

/** 替换字符串中的 {{variable}} 为对应的值 */
export function interpolateVariables(template: string, vars: Record<string, string>): string {
  if (!template) return ""
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    return vars[key] !== undefined ? vars[key] : `{{${key}}}`
  })
}

export class ApiClientService {
  /** Initializes the instance and its required dependencies. */
  constructor(private store: ApiClientStore) {}

  /** Sends request. */
  async sendRequest(options: ApiSendOptions): Promise<ApiResponseData> {
    const vars = options.envVariables || {}
    let rawUrl = interpolateVariables(options.url.trim(), vars)
    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      rawUrl = `https://${rawUrl}`
    }

    const urlObj = new URL(rawUrl)

    // 拼装 Query Params
    if (options.params && options.params.length > 0) {
      for (const p of options.params) {
        if (p.enabled && p.key) {
          urlObj.searchParams.append(interpolateVariables(p.key, vars), interpolateVariables(p.value, vars))
        }
      }
    }

    // 拼装 Headers
    const reqHeaders: Record<string, string> = {}
    if (options.headers && options.headers.length > 0) {
      for (const h of options.headers) {
        if (h.enabled && h.key) {
          reqHeaders[interpolateVariables(h.key, vars)] = interpolateVariables(h.value, vars)
        }
      }
    }

    // Auth 注入
    if (options.authType === "bearer" && options.authConfig?.token) {
      reqHeaders["Authorization"] = `Bearer ${interpolateVariables(options.authConfig.token, vars)}`
    } else if (options.authType === "basic" && options.authConfig?.username) {
      const u = interpolateVariables(options.authConfig.username, vars)
      const p = interpolateVariables(options.authConfig.password || "", vars)
      const base64 = Buffer.from(`${u}:${p}`).toString("base64")
      reqHeaders["Authorization"] = `Basic ${base64}`
    } else if (options.authType === "apiKey" && options.authConfig?.apiKeyName && options.authConfig?.apiKeyValue) {
      const keyName = interpolateVariables(options.authConfig.apiKeyName, vars)
      const keyValue = interpolateVariables(options.authConfig.apiKeyValue, vars)
      if (options.authConfig.apiKeyLocation === "query") {
        urlObj.searchParams.append(keyName, keyValue)
      } else {
        reqHeaders[keyName] = keyValue
      }
    }

    // Body 处理
    let bodyData: BodyInit | undefined = undefined
    const method = (options.method || "GET").toUpperCase()

    if (method !== "GET" && method !== "HEAD") {
      if (options.bodyType === "raw") {
        bodyData = interpolateVariables(options.bodyContent || "", vars)
        if (options.rawType === "json" && !reqHeaders["Content-Type"]) {
          reqHeaders["Content-Type"] = "application/json; charset=utf-8"
        } else if (options.rawType === "html" && !reqHeaders["Content-Type"]) {
          reqHeaders["Content-Type"] = "text/html; charset=utf-8"
        } else if (options.rawType === "xml" && !reqHeaders["Content-Type"]) {
          reqHeaders["Content-Type"] = "application/xml; charset=utf-8"
        } else if (!reqHeaders["Content-Type"]) {
          reqHeaders["Content-Type"] = "text/plain; charset=utf-8"
        }
      } else if (options.bodyType === "x-www-form-urlencoded") {
        try {
          const fields = JSON.parse(options.bodyContent || "[]") as { key: string; value: string; enabled: boolean }[]
          const usp = new URLSearchParams()
          for (const f of fields) {
            if (f.enabled && f.key) usp.append(interpolateVariables(f.key, vars), interpolateVariables(f.value, vars))
          }
          bodyData = usp.toString()
          if (!reqHeaders["Content-Type"]) reqHeaders["Content-Type"] = "application/x-www-form-urlencoded"
        } catch {
          bodyData = options.bodyContent || ""
        }
      } else if (options.bodyType === "form-data") {
        try {
          const fields = JSON.parse(options.bodyContent || "[]") as { key: string; value: string; enabled: boolean }[]
          const form = new FormData()
          for (const f of fields) {
            if (f.enabled && f.key) form.append(interpolateVariables(f.key, vars), interpolateVariables(f.value, vars))
          }
          bodyData = form
        } catch {
          bodyData = options.bodyContent || ""
        }
      }
    }

    const startTime = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000)

    try {
      const response = await fetch(urlObj.toString(), {
        method,
        headers: reqHeaders,
        body: bodyData,
        signal: controller.signal
      })
      clearTimeout(timeout)
      const durationMs = Date.now() - startTime

      const resHeaders: Record<string, string> = {}
      response.headers.forEach((val, key) => {
        resHeaders[key] = val
      })

      const cookies: string[] = []
      const setCookie = response.headers.get("set-cookie")
      if (setCookie) cookies.push(setCookie)

      const contentType = response.headers.get("content-type") || ""
      const textBody = await response.text()
      const sizeBytes = Buffer.byteLength(textBody, "utf-8")

      // 执行测试用例
      const testResults = this.runTests(options.tests || "", {
        status: response.status,
        statusText: response.statusText,
        durationMs,
        headers: resHeaders,
        bodyText: textBody
      })

      const result: ApiResponseData = {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders,
        cookies,
        durationMs,
        sizeBytes,
        body: textBody,
        contentType,
        testResults
      }

      // 保存至历史记录
      this.store.addHistory({
        method,
        url: urlObj.toString(),
        status: response.status,
        statusText: response.statusText,
        durationMs,
        sizeBytes,
        requestData: JSON.stringify(options),
        responsePreview: textBody.slice(0, 500),
        createdAt: Date.now()
      })

      return result
    } catch (err: any) {
      clearTimeout(timeout)
      const durationMs = Date.now() - startTime
      const isAbort = err.name === "AbortError"
      const errorMsg = isAbort ? `请求超时 (${options.timeoutMs || 30000}ms)` : err.message || String(err)

      const testResults = this.runTests(options.tests || "", {
        status: 0,
        statusText: "Network Error",
        durationMs,
        headers: {},
        bodyText: errorMsg
      })

      const failResult: ApiResponseData = {
        status: 0,
        statusText: isAbort ? "Timeout" : "Error",
        headers: {},
        cookies: [],
        durationMs,
        sizeBytes: Buffer.byteLength(errorMsg, "utf-8"),
        body: errorMsg,
        contentType: "text/plain",
        testResults
      }

      this.store.addHistory({
        method,
        url: urlObj.toString(),
        status: 0,
        statusText: failResult.statusText,
        durationMs,
        sizeBytes: failResult.sizeBytes,
        requestData: JSON.stringify(options),
        responsePreview: errorMsg,
        createdAt: Date.now()
      })

      return failResult
    }
  }

  /** Postman 风格测试断言运行器 */
  private runTests(testsScript: string, res: { status: number; statusText: string; durationMs: number; headers: Record<string, string>; bodyText: string }): ApiTestResult[] {
    if (!testsScript || !testsScript.trim()) return []

    const results: ApiTestResult[] = []

    let jsonBody: any = null
    try {
      jsonBody = JSON.parse(res.bodyText)
    } catch {}

    const pm = {
      response: {
        code: res.status,
        status: res.statusText,
        responseTime: res.durationMs,
        headers: res.headers,

        /** Performs the text operation. */
        text: () => res.bodyText,

        /** Performs the json operation. */
        json: () => {
          if (jsonBody === null) throw new Error("Response body is not valid JSON")
          return jsonBody
        },
        to: {
          have: {
            /** Performs the status operation. */
            status: (expected: number) => {
              if (res.status !== expected) {
                throw new Error(`Expected status ${expected} but got ${res.status}`)
              }
            }
          }
        }
      },

      /** Tests test. */
      test: (name: string, fn: () => void) => {
        try {
          fn()
          results.push({ name, passed: true })
        } catch (e: any) {
          results.push({ name, passed: false, error: e.message || String(e) })
        }
      },

      /** Performs the expect operation. */
      expect: (val: any) => ({
        to: {
          /** Performs the equal operation. */
          equal: (exp: any) => {
            if (val !== exp) throw new Error(`Expected ${val} to equal ${exp}`)
          },
          be: {
            /** Performs the below operation. */
            below: (exp: number) => {
              if (!(val < exp)) throw new Error(`Expected ${val} to be below ${exp}`)
            },

            /** Performs the above operation. */
            above: (exp: number) => {
              if (!(val > exp)) throw new Error(`Expected ${val} to be above ${exp}`)
            },

            /** Performs the true operation. */
            true: () => {
              if (val !== true) throw new Error(`Expected true but got ${val}`)
            }
          },

          /** Performs the include operation. */
          include: (exp: any) => {
            if (typeof val === "string" && !val.includes(exp)) {
              throw new Error(`Expected text to include "${exp}"`)
            }
          }
        }
      })
    }

    try {
      const runner = new Function("pm", testsScript)
      runner(pm)
    } catch (e: any) {
      results.push({
        name: "Script Execution",
        passed: false,
        error: e.message || String(e)
      })
    }

    return results
  }

  /** 集合批量运行 (Collection Runner) */
  async runCollection(
    collectionId: string,
    envVariables: Record<string, string> = {}
  ): Promise<{
    total: number
    passed: number
    failed: number
    results: { name: string; url: string; status: number; durationMs: number; passed: boolean; testResults: ApiTestResult[] }[]
  }> {
    const requests = this.store.listRequests(collectionId)
    const runResults: { name: string; url: string; status: number; durationMs: number; passed: boolean; testResults: ApiTestResult[] }[] = []
    let passedCount = 0
    let failedCount = 0

    for (const req of requests) {
      let parsedHeaders: any[] = []
      let parsedParams: any[] = []
      let parsedAuth: any = {}
      try {
        parsedHeaders = JSON.parse(req.headers)
      } catch {}
      try {
        parsedParams = JSON.parse(req.params)
      } catch {}
      try {
        parsedAuth = JSON.parse(req.authConfig)
      } catch {}

      const res = await this.sendRequest({
        method: req.method,
        url: req.url,
        headers: parsedHeaders,
        params: parsedParams,
        bodyType: req.bodyType,
        bodyContent: req.bodyContent,
        rawType: req.rawType,
        authType: req.authType,
        authConfig: parsedAuth,
        tests: req.tests,
        envVariables
      })

      const allTestsPassed = res.testResults.length === 0 ? res.status >= 200 && res.status < 400 : res.testResults.every((t) => t.passed)
      if (allTestsPassed) passedCount++
      else failedCount++

      runResults.push({
        name: req.name,
        url: req.url,
        status: res.status,
        durationMs: res.durationMs,
        passed: allTestsPassed,
        testResults: res.testResults
      })
    }

    return {
      total: requests.length,
      passed: passedCount,
      failed: failedCount,
      results: runResults
    }
  }
}
