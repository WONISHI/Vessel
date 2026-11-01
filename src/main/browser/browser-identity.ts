import type { Session } from "electron"

const major = process.versions.chrome.split(".")[0]
const full = process.versions.chrome

/** Chrome-equivalent UA without the app / Electron tokens that some services reject. */
export const chromeUserAgent = (base: string) =>
  base
    .replace(/\s+vessel\/\S+/gi, "")
    .replace(/\s+Electron\/\S+/g, "")
    .replace(/Chrome\/[\d.]+/, `Chrome/${major}.0.0.0`)

export const browserAcceptLanguages = "zh-CN,zh;q=0.9"
const brands = `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not_A Brand";v="99"`
const fullBrands = `"Chromium";v="${full}", "Google Chrome";v="${full}", "Not_A Brand";v="99.0.0.0"`
const configured = new WeakSet<Session>()

/**
 * Presents the in-app browser (pages, extension popups and background contexts) as stock Chrome.
 * Electron allows one onBeforeSendHeaders listener per session, so all request header rewrites live here.
 */
export function applyBrowserIdentity(browserSession: Session) {
  if (configured.has(browserSession)) return
  configured.add(browserSession)
  browserSession.setUserAgent(chromeUserAgent(browserSession.getUserAgent()), browserAcceptLanguages)
  browserSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders
    for (const name of Object.keys(headers)) {
      const key = name.toLowerCase()
      if (key === "sec-ch-ua") headers[name] = brands
      else if (key === "sec-ch-ua-full-version-list") headers[name] = fullBrands
      else if (key === "user-agent" && /Electron\/|vessel\//i.test(headers[name])) headers[name] = chromeUserAgent(headers[name])
    }
    callback({ requestHeaders: headers })
  })
}
