import type { Session } from "electron"

const registered = new WeakSet<Session>()
const helperHosts = new Set(["iguge.xyz", "igghelper.com"])

export function upgradeHelperHeaders(url: string, resourceType: string, headers: Record<string, string[]> = {}) {
  const target = new URL(url)
  if (target.protocol !== "https:" || target.port || !helperHosts.has(target.hostname) ||
      !(target.pathname === "/helper" || target.pathname.startsWith("/helper/")) ||
      !["mainFrame", "subFrame"].includes(resourceType)) return headers

  // Add a separate policy: existing site restrictions must remain in force.
  // Chromium upgrades subresources before its mixed-content check runs.
  const key = Object.keys(headers).find(name => name.toLowerCase() === "content-security-policy") || "Content-Security-Policy"
  const policies = headers[key] || []
  return { ...headers, [key]: [...policies, "upgrade-insecure-requests"] }
}

export function registerBrowserSiteCompatibility(browserSession: Session) {
  if (registered.has(browserSession)) return
  registered.add(browserSession)
  browserSession.webRequest.onHeadersReceived(
    { urls: ["https://iguge.xyz/*", "https://igghelper.com/*"] },
    (details, callback) => callback({ responseHeaders: upgradeHelperHeaders(details.url, details.resourceType, details.responseHeaders) })
  )
}
