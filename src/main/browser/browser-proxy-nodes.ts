import { parse } from "yaml"
import { browserProxyConfig } from "./browser-proxy-config"

/** Read subscription nodes without starting the proxy core or changing routing. */
export async function browserProxyNodes(source: string, load: (url: string) => Promise<string>): Promise<string[]> {
  const config = parse(browserProxyConfig(source, 0, 0, ""), { maxAliasCount: 50 })
  const names = new Set<string>()
  const collect = (nodes: unknown) => {
    if (!Array.isArray(nodes)) throw new Error("订阅节点格式无效")
    for (const node of nodes) {
      if (!node || typeof node.name !== "string" || typeof node.type !== "string") throw new Error("订阅节点格式无效")
      names.add(node.name)
      if (names.size > 5000) throw new Error("订阅节点数量过多")
    }
  }
  collect(config.proxies)
  const providers = Object.values(config["proxy-providers"]) as { type: string; url?: string; payload?: unknown[] }[]
  if (providers.length > 64) throw new Error("订阅节点提供方数量过多")
  let next = 0
  const results: unknown[] = new Array(providers.length)
  await Promise.all(Array.from({ length: Math.min(providers.length, 4) }, async () => {
    while (next < providers.length) {
      const index = next++, provider = providers[index]
      results[index] = provider.type === "inline" ? provider.payload : parse(await load(provider.url!), { maxAliasCount: 50 })?.proxies
    }
  }))
  results.forEach(collect)
  return [...names]
}
