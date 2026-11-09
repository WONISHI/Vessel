import { mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { ApiClientService } from "@main/modules/api-client/api-client-service"
import { ApiClientStore } from "@main/modules/api-client/store"

it("runs scripts around a real request, keeps cookies and returns binary bodies as base64", async () => {
  const seen: { url?: string; cookie?: string; token?: string }[] = []
  const server = createServer((req, res) => {
    seen.push({ url: req.url, cookie: req.headers.cookie, token: req.headers["x-token"] as string | undefined })
    if (req.url?.startsWith("/img")) {
      res.writeHead(200, { "Content-Type": "image/png" }).end(Buffer.from([137, 80, 78, 71]))
      return
    }
    res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": ["sid=42; Path=/; HttpOnly"] }).end(JSON.stringify({ id: 7 }))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const directory = mkdtempSync(join(tmpdir(), "vessel-api-service-"))
  const store = new ApiClientStore(join(directory, "api.sqlite"))
  const service = new ApiClientService(store)
  try {
    const first = await service.sendRequest({
      method: "GET",
      url: "{{base}}/items?q={{q}}",
      envVariables: { base },
      headers: [{ key: "X-Token", value: "{{token}}", enabled: true }],
      preRequestScript: `pm.environment.set("q", "a b"); pm.environment.set("token", "t1")`,
      tests: `pm.test("ok", () => pm.response.to.have.status(200)); pm.environment.set("itemId", pm.response.json().id)`
    })
    expect(first.status).toBe(200)
    expect(first.testResults).toEqual([{ name: "ok", passed: true }])
    expect(first.envUpdates).toEqual({ q: "a b", token: "t1", itemId: "7" })
    expect(seen[0]).toMatchObject({ url: "/items?q=a%20b", token: "t1", cookie: undefined })
    expect(store.listCookies()).toMatchObject([{ domain: "127.0.0.1", name: "sid", value: "42" }])

    const image = await service.sendRequest({ method: "GET", url: `${base}/img` })
    expect(seen[1].cookie).toBe("sid=42")
    expect(image).toMatchObject({ bodyEncoding: "base64", body: Buffer.from([137, 80, 78, 71]).toString("base64"), sizeBytes: 4 })

    const invalid = await service.sendRequest({ method: "GET", url: "http://exa mple.com" })
    expect(invalid.status).toBe(0)
  } finally {
    server.close()
    store.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
