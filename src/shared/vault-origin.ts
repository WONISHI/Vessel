/** Local development logins are allowed alongside HTTPS; credentials remain scoped to the exact origin. */
export function vaultCredentialOrigin(href: string): string | undefined {
  try {
    const url = new URL(href)
    const loopback = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
    if (url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) return url.origin
  } catch { /* Malformed and opaque URLs cannot hold site credentials. */ }
  return undefined
}
