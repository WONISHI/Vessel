import { expect, it, vi } from "vitest"
import { browserProxyNodes } from "../../src/main/browser/browser-proxy-nodes"
it("reads direct, inline and remote provider nodes without running the proxy core", async () => {
 const load = vi.fn().mockResolvedValue('proxies: [{name: remote, type: ss}]')
 const source = 'proxies: [{name: direct, type: ss}]\nproxy-providers:\n  inline: {type: inline, payload: [{name: inline, type: ss}]}\n  remote: {type: http, url: "https://example.test/nodes"}'
 expect(await browserProxyNodes(source, load)).toEqual(["direct", "inline", "remote"])
 expect(load).toHaveBeenCalledWith("https://example.test/nodes")
})
it("rejects invalid provider node payloads", async () => {
 await expect(browserProxyNodes('proxy-providers: {bad: {type: http, url: "https://example.test/nodes"}}', async () => 'proxies: [{name: invalid}]')).rejects.toThrow("订阅节点格式无效")
})
