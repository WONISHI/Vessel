import { getBrowserBookmarks, setBrowserBookmarks } from "@main/browser/browser-tools"
import { hasExtensionBridgeToken, openExtensionTab } from "@main/browser/extensions/extension-tab-bridge"
import { BaseModule } from "@main/modules/base/index"
import { getCurrentWorkspace } from "@main/settings/settings"
import { BrowserWindow } from "electron"
import { mkdir, stat, writeFile } from "node:fs/promises"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { join, relative } from "node:path"

const BRIDGE_PORT = 35678

let activePageMetadata: any = null

/** Sets active page metadata. */
export function setActivePageMetadata(data: any) {
  activePageMetadata = data
}

/** Returns active page metadata. */
export function getActivePageMetadata() {
  return activePageMetadata
}

interface ClipPayload {
  title?: string
  url?: string
  markdown?: string
  tags?: string[]
  folder?: string
  author?: string
  description?: string
  timestamp?: string
}

interface BookmarkItem {
  url: string
  title: string
  folder?: string
  dateAdded?: number
}

interface BookmarkSyncPayload {
  direction?: "bidirectional" | "push" | "pull"
  bookmarks?: BookmarkItem[]
  strategy?: "keep-both" | "keep-newer" | "keep-local" | "keep-remote"
}

export class ExtensionBridgeModule extends BaseModule {
  private server: Server | null = null

  /** Handles activate events. */
  protected onActivate(): void {
    try {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          console.error("[ExtensionBridge] Request error:", err)
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })
      })

      this.server.on("error", async (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          try {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 1000)
            const resp = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/api/ping`, { signal: controller.signal })
            clearTimeout(timer)
            const data: any = await resp.json()
            if (data?.app === "Vessel") {
              console.log(`[ExtensionBridge] 已检测到运行中的 Vessel 实例已在端口 ${BRIDGE_PORT} 提供扩展桥接服务。`)
              return
            }
          } catch {}
          console.warn(`[ExtensionBridge] 端口 ${BRIDGE_PORT} 已被占用，扩展桥接服务未能在此端口启动。`)
        } else {
          console.error("[ExtensionBridge] Server error:", err)
        }
      })

      this.server.listen(BRIDGE_PORT, "127.0.0.1", () => {
        console.log(`[ExtensionBridge] Local server running at http://127.0.0.1:${BRIDGE_PORT}`)
      })
    } catch (e) {
      console.warn("[ExtensionBridge] Failed to initialize server:", e)
    }
  }

  /** Handles dispose events. */
  protected onDispose(): void {
    if (this.server) {
      try {
        ;(this.server as any).closeAllConnections?.()
        this.server.close()
      } catch {}
      this.server = null
    }
  }

  /** Sets cors headers. */
  private setCorsHeaders(res: ServerResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
  }

  /** Parses body. */
  private async parseBody<T>(req: IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let totalLength = 0
      req.on("data", (chunk: Buffer) => {
        totalLength += chunk.length
        if (totalLength > 10 * 1024 * 1024) {
          reject(new Error("Request payload exceeds 10MB limit"))
          return
        }
        chunks.push(chunk)
      })
      req.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8")
          resolve(raw ? JSON.parse(raw) : {})
        } catch (e) {
          reject(new Error("Invalid JSON body"))
        }
      })
      req.on("error", reject)
    })
  }

  /** Sanitizes filename. */
  private sanitizeFilename(name: string): string {
    const sanitized = name
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
    return (sanitized.slice(0, 100) || "未命名剪藏") + ".md"
  }

  /** Handles request events. */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.setCorsHeaders(res)

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    const parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${BRIDGE_PORT}`)
    const pathname = parsedUrl.pathname
    if (pathname === "/api/extension-login-diagnostic" && req.method === "POST") {
      const authorized = hasExtensionBridgeToken(req.headers.authorization?.replace(/^Bearer /, ""))
      if (!authorized) { res.writeHead(403); res.end(); return }
      const data = await this.parseBody<Record<string, unknown>>(req)
      const endpoints = ["/page/muser/login", "/chromeext/email/sendcode_v2", "/chromeext/v2/email_login"]
      if (endpoints.includes(String(data.endpoint))) console.info("[IGG Login]", {
        endpoint: data.endpoint,
        status: typeof data.status === "number" ? data.status : 0,
        tokenPresent: data.tokenPresent === true,
        runtimeIdMatched: data.runtimeIdMatched === true,
        formTokenPresent: data.formTokenPresent === true,
        success: data.success === true,
        invalidToken: data.invalidToken === true
      })
      res.writeHead(200); res.end()
      return
    }
    if (pathname === "/api/extension-tab" && req.method === "POST") {
      const body = await this.parseBody<{ url?: unknown }>(req)
      const token = req.headers.authorization?.replace(/^Bearer /, "")
      const ok = openExtensionTab(token, body.url)
      res.writeHead(ok ? 200 : 403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok }))
      return
    }

    if (pathname === "/api/status" || pathname === "/api/ping") {
      const workspace = getCurrentWorkspace()
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          ok: true,
          app: "Vessel",
          version: "1.0.0",
          workspace: workspace
            ? {
                path: workspace,
                name: workspace.split(/[\\/]/).filter(Boolean).pop()
              }
            : null
        })
      )
      return
    }

    if (pathname === "/api/active-page") {
      if (req.method === "POST") {
        const body = await this.parseBody<any>(req)
        setActivePageMetadata(body)
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true, data: getActivePageMetadata() }))
        return
      }
      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true, data: getActivePageMetadata() }))
        return
      }
    }

    if (pathname === "/api/clip" && req.method === "POST") {
      const body = await this.parseBody<ClipPayload>(req)
      const workspace = getCurrentWorkspace()
      if (!workspace) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: false, message: "请先在 Vessel 中打开工作区以保存剪藏内容" }))
        return
      }

      const folderName = (body.folder || "Clippings").trim().replace(/^[/\\]+/, "")
      const targetDir = join(workspace, folderName)
      await mkdir(targetDir, { recursive: true })

      const title = body.title?.trim() || "未命名剪藏"
      let filename = this.sanitizeFilename(title)
      let filePath = join(targetDir, filename)

      // 避免同名文件直接覆盖
      try {
        if ((await stat(filePath)).isFile()) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
          filename = this.sanitizeFilename(`${title} - ${timestamp}`)
          filePath = join(targetDir, filename)
        }
      } catch {}

      const fileContent = body.markdown ?? `# ${title}\n\n${body.description ?? ""}\n\n[原文链接](${body.url ?? ""})`
      await writeFile(filePath, fileContent, "utf8")

      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          ok: true,
          success: true,
          message: "剪藏成功",
          filename,
          relativePath: relative(workspace, filePath),
          path: filePath
        })
      )
      return
    }

    if (pathname === "/api/bookmarks") {
      if (req.method === "GET") {
        let bookmarks: { url: string; title: string }[] = []
        try {
          bookmarks = getBrowserBookmarks()
        } catch {}

        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true, bookmarks }))
        return
      }
    }

    if (pathname === "/api/bookmarks/sync" && req.method === "POST") {
      const body = await this.parseBody<BookmarkSyncPayload>(req)
      const incoming = (body.bookmarks ?? []).filter((b) => b && typeof b.url === "string" && b.url.startsWith("http"))
      const direction = (body.direction || "bidirectional") as string
      const strategy = body.strategy || "keep-newer"
      let current: { url: string; title: string }[] = []
      try {
        current = getBrowserBookmarks()
      } catch {}

      let resultBookmarks: { url: string; title: string }[] = []

      if (direction === "push" || direction === "push-overwrite") {
        // Chrome 覆盖 Vessel
        resultBookmarks = incoming.map((b) => ({ url: b.url, title: b.title || b.url }))
      } else if (direction === "pull" || direction === "pull-overwrite") {
        // Vessel 覆盖 Chrome
        resultBookmarks = current
      } else if (direction === "add-only" || direction === "incremental-add") {
        // 仅增量追加新书签，不修改已有书签也不删除
        const map = new Map<string, { url: string; title: string }>()
        for (const item of current) {
          map.set(item.url, item)
        }
        for (const item of incoming) {
          if (!map.has(item.url)) {
            map.set(item.url, { url: item.url, title: item.title || item.url })
          }
        }
        resultBookmarks = Array.from(map.values())
      } else if (direction === "mirror" || direction === "bidirectional-mirror") {
        // 双向镜像同步：切实更新同 URL 书签的标题
        const map = new Map<string, { url: string; title: string }>()
        for (const item of current) {
          map.set(item.url, item)
        }
        for (const item of incoming) {
          map.set(item.url, { url: item.url, title: item.title || map.get(item.url)?.title || item.url })
        }
        resultBookmarks = Array.from(map.values())
      } else {
        // 双向智能合并与更新
        const map = new Map<string, { url: string; title: string }>()
        for (const item of current) {
          map.set(item.url, item)
        }
        for (const item of incoming) {
          const existing = map.get(item.url)
          if (!existing) {
            map.set(item.url, { url: item.url, title: item.title || item.url })
          } else {
            // 切实更新已有书签的标题与信息！
            if (strategy === "keep-remote") {
              // 保留 Vessel 现有标题
            } else {
              map.set(item.url, { url: item.url, title: item.title || existing.title })
            }
          }
        }
        resultBookmarks = Array.from(map.values())
      }

      try {
        setBrowserBookmarks(resultBookmarks)
        // 广播通知所有渲染窗口即时刷新书签栏
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send("browser:bookmarks-updated", resultBookmarks)
          }
        }
      } catch (e) {
        console.error("[ExtensionBridge] Failed to update browser bookmarks:", e)
      }

      // 同时若有打开的工作区，持久化到 .vessel/bookmarks.json
      const workspace = getCurrentWorkspace()
      if (workspace) {
        try {
          const vesselDir = join(workspace, ".vessel")
          await mkdir(vesselDir, { recursive: true })
          await writeFile(
            join(vesselDir, "bookmarks.json"),
            JSON.stringify(
              {
                updatedAt: new Date().toISOString(),
                total: resultBookmarks.length,
                bookmarks: resultBookmarks
              },
              null,
              2
            ),
            "utf8"
          )
        } catch {}
      }

      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          ok: true,
          success: true,
          direction,
          total: resultBookmarks.length,
          bookmarks: resultBookmarks
        })
      )
      return
    }

    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: "Not Found" }))
  }
}
