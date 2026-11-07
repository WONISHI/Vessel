/** Converts Electron load failures into concise browser messages. */
export function browserNavigationError(error: unknown): string {
  const message = String(error)
  if (/ERR_ABORTED|\(-3\)/.test(message)) return ""
  const code = message.match(/ERR_[A-Z_]+/)?.[0]
  const descriptions: Record<string, string> = {
    ERR_CONNECTION_CLOSED: "连接被网站或中间网络关闭，请检查代理或网络连接后重试。",
    ERR_CONNECTION_RESET: "连接被重置，请检查网络后重试。",
    ERR_CONNECTION_REFUSED: "网站拒绝连接，请确认地址和服务状态。",
    ERR_NAME_NOT_RESOLVED: "无法解析网站域名，请检查地址或 DNS 设置。",
    ERR_INTERNET_DISCONNECTED: "网络已断开，请连接网络后重试。",
    ERR_TIMED_OUT: "连接超时，请稍后重试。",
    ERR_CONNECTION_TIMED_OUT: "连接超时，请稍后重试。",
    ERR_PROXY_CONNECTION_FAILED: "无法连接代理服务器，请检查代理配置。",
    ERR_TUNNEL_CONNECTION_FAILED: "代理连接失败，请检查代理配置。"
  }
  return code ? `${descriptions[code] ?? "页面加载失败，请稍后重试。"}（${code}）` : "页面加载失败，请稍后重试。"
}
