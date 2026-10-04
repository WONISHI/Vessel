/** Bing tracking pages are navigation intermediates, not visited content. */
export function isHistoryRedirect(raw: string) {
  try { const url = new URL(raw); return /(^|\.)bing\.com$/i.test(url.hostname) && /^\/ck\/a\/?$/i.test(url.pathname) } catch { return false }
}
export function historyURLKey(raw: string) {
  try { const url = new URL(raw); url.hash = ''; url.pathname = url.pathname.replace(/\.html?$/i, '').replace(/\/$/, '') || '/'; return url.href } catch { return raw }
}
