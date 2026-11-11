import type { ProxyConfig } from "electron"

/** Translate Chrome's ProxyConfig into Electron's session proxy config. */
export function extensionProxyConfig(value: any): ProxyConfig {
  if (!value || typeof value !== "object") throw new Error("无效的扩展代理配置")
  if (["direct", "system", "auto_detect"].includes(value.mode)) return { mode: value.mode }
  if (value.mode === "pac_script") {
    const pac = value.pacScript
    if (typeof pac?.data === "string" && pac.data.length <= 4 * 1024 * 1024) return { mode: "pac_script", pacScript: `data:application/x-ns-proxy-autoconfig;base64,${Buffer.from(pac.data).toString("base64")}` }
    if (typeof pac?.url === "string" && /^https?:\/\//i.test(pac.url)) return { mode: "pac_script", pacScript: pac.url }
    throw new Error("无效的 PAC 配置")
  }
  if (value.mode !== "fixed_servers") throw new Error("不支持的代理模式")
  const rules = value.rules || {}
  const server = (item: any) => {
    const scheme = item?.scheme || "http"
    if (!["http", "https", "socks4", "socks5", "quic"].includes(scheme) || typeof item?.host !== "string" || !/^[\w.:[\]-]+$/.test(item.host)) throw new Error("无效的代理服务器")
    const port = item.port ?? (scheme.startsWith("socks") ? 1080 : scheme === "https" ? 443 : 80)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("无效的代理端口")
    return `${scheme}://${item.host}:${port}`
  }
  const proxyRules = rules.singleProxy ? server(rules.singleProxy) : [
    ["http", rules.proxyForHttp], ["https", rules.proxyForHttps], ["ftp", rules.proxyForFtp], ["socks", rules.fallbackProxy]
  ].filter(([, item]) => item).map(([scheme, item]) => `${scheme}=${server(item)}`).join(";")
  if (!proxyRules) throw new Error("代理服务器不能为空")
  if (rules.bypassList && (!Array.isArray(rules.bypassList) || !rules.bypassList.every((item: unknown) => typeof item === "string" && !item.includes(";")))) throw new Error("无效的代理绕过列表")
  return { mode: "fixed_servers", proxyRules, proxyBypassRules: rules.bypassList?.join(";") || "" }
}
