import type { WebContents } from "electron"

const MAX_SOURCE_LENGTH = 4 * 1024 * 1024

/** SPA history routes and authenticated pages may not support a second direct request. */
export async function readBrowserSource(target: WebContents): Promise<string> {
  const url = target.getURL()
  if (!/^(https?:|file:)/.test(url)) throw new Error("不支持的网页地址")
  let text: unknown
  try {
    const response = await target.session.fetch(url)
    if (response.ok) text = await response.text()
  } catch { /* Read the loaded document when a repeat request is unavailable. */ }
  if (target.isDestroyed() || target.getURL() !== url) throw new Error("页面已切换，请重新查看源代码")
  if (text === undefined) {
    text = await target.executeJavaScript(`(() => {
      if (location.href !== ${JSON.stringify(url)}) return null;
      if (!document.documentElement) return null;
      const doctype = document.doctype ? new XMLSerializer().serializeToString(document.doctype) + '\\n' : '';
      return doctype + document.documentElement.outerHTML;
    })()`)
    if (target.isDestroyed() || target.getURL() !== url) throw new Error("页面已切换，请重新查看源代码")
  }
  if (typeof text !== "string" || !text.length) throw new Error("无法读取当前页面 HTML，请等待页面加载后重试")
  if (text.length > MAX_SOURCE_LENGTH) throw new Error("网页源代码过大")
  return text
}
