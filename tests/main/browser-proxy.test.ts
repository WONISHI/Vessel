import { describe, expect, it } from "vitest"
import { parse } from "yaml"
import { browserProxyConfig } from "../../src/main/browser-proxy-config"
describe("browser-only proxy config", () => {
  it("replaces remote listeners and routing with localhost browser-only routing", () => {
    const config = parse(browserProxyConfig(`mixed-port: 9999\nallow-lan: true\ntun:\n  enable: true\nexternal-controller: 0.0.0.0:9000\nproxies:\n  - name: local-test\n    type: http\n    server: 127.0.0.1\n    port: 9998\n`, 2000, 2001, "secret"))
    expect(config["mixed-port"]).toBe(2000)
    expect(config["allow-lan"]).toBe(false)
    expect(config.tun.enable).toBe(false)
    expect(config["external-controller"]).toBe("127.0.0.1:2001")
    expect(config.rules).toEqual(["MATCH,Vessel"])
    expect(config["proxy-groups"][0].proxies).toEqual(["local-test"])
  })
  it("rejects empty subscriptions", () => {
    expect(() => browserProxyConfig("<html>login</html>", 1, 2, "x")).toThrow()
    expect(() => browserProxyConfig("proxies: []", 1, 2, "x")).toThrow()
  })
  it("normalizes provider cache paths", () => {
    const config = parse(browserProxyConfig("proxy-providers:\n  remote:\n    type: http\n    url: https://example.com/sub\n    path: /tmp/unsafe\n", 1, 2, "x"))
    expect(config["proxy-providers"].remote.path).toBe("./providers/0.yaml")
  })
})
