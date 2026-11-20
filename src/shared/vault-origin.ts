/** HTTP(S) logins, including self-hosted IP sites, remain scoped to the exact origin. */
export function vaultCredentialOrigin(href: string): string | undefined {
  try {
    const url = new URL(href)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin
  } catch { /* Malformed and opaque URLs cannot hold site credentials. */ }
  return undefined
}
