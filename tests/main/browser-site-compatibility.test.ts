import { expect, it, vi } from "vitest"
import type { Session } from "electron"
import { registerBrowserSiteCompatibility, upgradeHelperHeaders } from "../../src/main/browser-site-compatibility"

it("upgrades helper documents while preserving all existing security policies", () => {
  const headers = { "content-security-policy": ["script-src 'self'", "object-src 'none'"], "X-Frame-Options": ["SAMEORIGIN"] }
  for (const host of ["iguge.xyz", "igghelper.com"]) {
    for (const frame of ["mainFrame", "subFrame"]) {
      expect(upgradeHelperHeaders(`https://${host}/helper/?page_id=210`, frame, headers)).toEqual({ ...headers, "content-security-policy": [...headers["content-security-policy"], "upgrade-insecure-requests"] })
    }
  }
  expect(headers["content-security-policy"]).toHaveLength(2)
})

it("leaves other sites, paths, ports and subresource responses untouched", () => {
  const headers = { "Content-Type": ["text/html"] }
  for (const url of ["https://example.com/helper/", "https://iguge.xyz.evil.test/helper/", "https://iguge.xyz/", "https://iguge.xyz/helper-other", "http://iguge.xyz/helper/", "https://iguge.xyz:8443/helper/"]) {
    expect(upgradeHelperHeaders(url, "mainFrame", headers)).toBe(headers)
  }
  expect(upgradeHelperHeaders("https://iguge.xyz/helper/", "script", headers)).toBe(headers)
})

it("installs only once per session and supplies a policy when the site has none", () => {
  const onHeadersReceived = vi.fn()
  const session = { webRequest: { onHeadersReceived } } as unknown as Session
  registerBrowserSiteCompatibility(session)
  registerBrowserSiteCompatibility(session)
  expect(onHeadersReceived).toHaveBeenCalledTimes(1)
  const callback = vi.fn()
  onHeadersReceived.mock.calls[0][1]({ url: "https://iguge.xyz/helper/", resourceType: "mainFrame" }, callback)
  expect(callback).toHaveBeenCalledWith({ responseHeaders: { "Content-Security-Policy": ["upgrade-insecure-requests"] } })
})
