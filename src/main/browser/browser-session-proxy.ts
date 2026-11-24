import { session, type Session, type ProxyConfig } from "electron"

const privateSessions = new Set<Session>()
let current: ProxyConfig = { mode: "system" }

/** Share network configuration, never cookies or storage, with temporary browser sessions. */
export async function attachBrowserSessionProxy(browser: Session) {
  privateSessions.add(browser)
  try { await browser.setProxy(current) }
  catch (error) { privateSessions.delete(browser); throw error }
}
export function detachBrowserSessionProxy(browser: Session) { privateSessions.delete(browser) }
export async function setBrowserSessionProxy(config: ProxyConfig) {
  current = config
  await Promise.all([session.fromPartition("persist:vessel-browser"), ...privateSessions].map(async browser => {
    await browser.setProxy(config)
    await browser.closeAllConnections()
  }))
}
export async function closeBrowserSessionConnections() {
  await Promise.all([session.fromPartition("persist:vessel-browser"), ...privateSessions].map(browser => browser.closeAllConnections()))
}
