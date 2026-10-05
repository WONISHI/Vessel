import { parse, stringify } from "yaml"
export function browserProxyConfig(source: string, port: number, controller: number, secret: string) {
  const parsed = parse(source, { maxAliasCount: 50 })
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("链接没有返回 Clash YAML 配置")
  const proxies = Array.isArray(parsed.proxies) ? parsed.proxies : []
  if (proxies.length > 5000 || proxies.some((p) => !p || typeof p.name !== "string" || typeof p.type !== "string")) throw new Error("订阅节点格式无效")
  const providers: Record<string, unknown> = {}
  for (const [index, [name, raw]] of Object.entries(parsed["proxy-providers"] || {}).entries()) {
    const provider = raw as { type?: string; url?: string; payload?: unknown[] }
    if (provider.type === "http" && typeof provider.url === "string" && /^https?:\/\//.test(provider.url)) providers[name] = { type: "http", url: provider.url, path: `./providers/${index}.yaml`, interval: 3600 }
    else if (provider.type === "inline" && Array.isArray(provider.payload)) providers[name] = { type: "inline", payload: provider.payload }
  }
  if (!proxies.length && !Object.keys(providers).length) throw new Error("没有找到节点；请使用 Clash 格式订阅链接")
  // Never inherit subscription listeners, TUN, external controllers, scripts or filesystem paths.
  return stringify({
    "mixed-port": port,
    "allow-lan": false,
    "bind-address": "127.0.0.1",
    mode: "rule",
    "log-level": "silent",
    ipv6: false,
    "external-controller": `127.0.0.1:${controller}`,
    secret,
    proxies,
    "proxy-providers": providers,
    "proxy-groups": [{ name: "Vessel", type: "select", proxies: proxies.map((p) => p.name), ...(Object.keys(providers).length ? { use: Object.keys(providers) } : {}) }],
    rules: ["MATCH,Vessel"],
    dns: { enable: false },
    tun: { enable: false }
  })
}
