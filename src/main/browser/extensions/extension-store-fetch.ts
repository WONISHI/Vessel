import { net, type Session } from "electron"
import { officialStoreDownload } from "./extension-store"

/** Electron fetch rejects manual redirects. Validate each net.request redirect before following it synchronously. */
export function storeSessionFetch(session: Session, url: string, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (!officialStoreDownload(url)) { reject(new Error("商店下载地址不是 Google HTTPS 地址")); return }
    const request = net.request({ url, session, redirect: "manual", method: "GET" })
    let redirected = 0, resolved = false, finished = false, bytes = 0
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined
    const cleanup = () => init.signal?.removeEventListener("abort", abort)
    const fail = (error: Error) => {
      if (finished) return
      finished = true
      cleanup()
      if (resolved) controller?.error(error)
      else reject(error)
      request.abort()
    }
    const abort = () => fail(new Error("商店下载已取消"))
    if (init.signal?.aborted) { abort(); return }
    init.signal?.addEventListener("abort", abort, { once: true })
    request.on("error", fail)
    request.on("redirect", (_status, _method, target) => {
      if (!officialStoreDownload(target) || ++redirected > 5) {
        fail(new Error("商店下载重定向地址或次数无效")); return
      }
      request.followRedirect()
    })
    request.on("response", response => {
      const headers = new Headers()
      for (const [key, values] of Object.entries(response.headers)) {
        for (const value of Array.isArray(values) ? values : [values]) headers.append(key, value)
      }
      if (Number(headers.get("content-length")) > 128 * 1024 * 1024) { fail(new Error("扩展包超过 128 MiB")); return }
      const stream = new ReadableStream<Uint8Array>({
        start(value) { controller = value },
        cancel() { if (!finished) { finished = true; cleanup(); request.abort() } }
      })
      response.on("end", () => { if (!finished) { finished = true; cleanup(); controller?.close() } })
      response.on("error", fail)
      response.on("aborted", () => fail(new Error("扩展下载连接中断")))
      response.on("data", chunk => {
        if (finished) return
        bytes += chunk.length
        if (bytes > 128 * 1024 * 1024) { fail(new Error("扩展包超过 128 MiB")); return }
        controller?.enqueue(new Uint8Array(chunk))
      })
      try {
        const result = new Response(stream, { status: response.statusCode, headers })
        resolved = true
        resolve(result)
      } catch (error) { fail(error instanceof Error ? error : new Error(String(error))) }
    })
    request.on("close", () => { if (!finished) fail(new Error("扩展下载连接提前关闭")) })
    request.end()
  })
}
