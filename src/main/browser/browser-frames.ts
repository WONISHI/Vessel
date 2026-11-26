import type { WebContents, WebFrameMain } from "electron"
import type { BrowserFrameInfo, BrowserFramesSnapshot } from "@vessel/type"

/** Chromium emits this only when the document did not cancel its default menu. */
export function registerFrameContextMenu(target: WebContents) {
  target.on("context-menu", (_event, params) => {
    if (!params.frame || params.frame === target.mainFrame) return
    target.send("vessel:frame-context-menu", { x: params.x, y: params.y })
  })
}

/** Run in each document separately, including cross-origin child documents. */
export const FRAME_SCAN_SCRIPT = `(() => {
  const elements = [];
  const scan = root => {
    for (const element of root.querySelectorAll('*')) {
      if (element.tagName === 'IFRAME') elements.push(element);
      if (element.shadowRoot) scan(element.shadowRoot);
    }
  };
  scan(document);
  const text = value => String(value || '').slice(0, 65536);
  return {total: elements.length, items: elements.slice(0, 500).map((element, index) => ({
    index, src: text(element.getAttribute('src')), resolvedSrc: text(element.src || 'about:blank'),
    name: text(element.name), title: text(element.title), elementId: text(element.id),
    sandbox: text(element.getAttribute('sandbox')), srcdoc: element.hasAttribute('srcdoc')
  }))};
})()`

async function scanFrame(frame: WebFrameMain) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      frame.executeJavaScript(FRAME_SCAN_SCRIPT),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("读取 iframe 超时")), 4000) })
    ])
  } finally { clearTimeout(timer) }
}

export async function readBrowserFrames(target: WebContents): Promise<BrowserFramesSnapshot> {
  const pageURL = target.getURL()
  const root = target.mainFrame
  const frames = root.framesInSubtree.slice(0, 256)
  const snapshot: BrowserFramesSnapshot = { pageURL, total: 0, items: [], unreadableDocuments: 0, truncated: root.framesInSubtree.length > frames.length }
  const results: BrowserFrameInfo[][] = new Array(frames.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < frames.length) {
      const index = cursor++, frame = frames[index]
      try {
        const documentURL = frame.url
        let depth = 0, parent = frame.parent
        while (parent && depth < 256) { depth++; parent = parent.parent }
        const raw = await scanFrame(frame)
        const result = raw as Record<string, unknown> | null
        if (frame.detached || frame.url !== documentURL) throw new Error("页面已改变")
        if (!result || typeof result.total !== "number" || !Number.isSafeInteger(result.total) || result.total < 0 || !Array.isArray(result.items)) throw new Error("无法读取 iframe")
        snapshot.total += result.total
        if (result.total > result.items.length) snapshot.truncated = true
        results[index] = result.items.slice(0, 500).map((item: Record<string, unknown>, itemIndex: number) => {
          const text = (key: string) => typeof item[key] === "string" ? item[key].slice(0, 65536) : ""
          return { id: `${frame.frameTreeNodeId}:${itemIndex}`, documentURL, depth, src: text("src"), resolvedSrc: text("resolvedSrc"), name: text("name"), title: text("title"), elementId: text("elementId"), sandbox: text("sandbox"), srcdoc: item.srcdoc === true }
        })
      } catch { snapshot.unreadableDocuments++ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, frames.length) }, worker))
  const items = results.flat().filter(Boolean)
  snapshot.items = items.slice(0, 2000)
  if (items.length > snapshot.items.length) snapshot.truncated = true
  if (target.isDestroyed() || target.mainFrame !== root || target.getURL() !== pageURL) throw new Error("页面已切换，请重新查看域")
  return snapshot
}
