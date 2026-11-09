import type { ApiCookieRecord } from "@vessel/type/api-client"

/** Default cookie path per RFC 6265 §5.1.4: the request path up to (not including) its last "/". */
function defaultPath(pathname: string): string {
  if (!pathname.startsWith("/")) return "/"
  const index = pathname.lastIndexOf("/")
  return index <= 0 ? "/" : pathname.slice(0, index)
}

/** Parses one Set-Cookie header value as received from `url`; returns null for cookies the host may not set. */
export function parseSetCookie(header: string, url: URL, now = Date.now()): ApiCookieRecord | null {
  const [pair, ...attributes] = header.split(";")
  const separator = pair.indexOf("=")
  if (separator <= 0) return null
  const cookie: ApiCookieRecord = { domain: url.hostname.toLowerCase(), path: defaultPath(url.pathname), name: pair.slice(0, separator).trim(), value: pair.slice(separator + 1).trim(), expires: null, secure: false, httpOnly: false }
  let maxAge: number | null = null
  for (const attribute of attributes) {
    const [rawKey, ...rest] = attribute.split("=")
    const key = rawKey.trim().toLowerCase()
    const value = rest.join("=").trim()
    if (key === "domain" && value) {
      const domain = value.replace(/^\./, "").toLowerCase()
      const host = url.hostname.toLowerCase()
      if (host !== domain && !host.endsWith(`.${domain}`)) return null
      cookie.domain = `.${domain}`
    } else if (key === "path" && value.startsWith("/")) cookie.path = value
    else if (key === "expires") {
      const time = Date.parse(value)
      if (!Number.isNaN(time)) cookie.expires = time
    } else if (key === "max-age" && /^-?\d+$/.test(value)) maxAge = Number(value)
    else if (key === "secure") cookie.secure = true
    else if (key === "httponly") cookie.httpOnly = true
  }
  if (maxAge !== null) cookie.expires = now + maxAge * 1000
  return cookie
}

/** Builds the Cookie header value for `url` from stored cookies (domain, path, secure and expiry matching). */
export function cookieHeaderFor(cookies: ApiCookieRecord[], url: URL, now = Date.now()): string {
  const host = url.hostname.toLowerCase()
  const path = url.pathname || "/"
  return cookies
    .filter((cookie) => {
      if (cookie.expires !== null && cookie.expires <= now) return false
      if (cookie.secure && url.protocol !== "https:") return false
      const domainOk = cookie.domain.startsWith(".") ? host === cookie.domain.slice(1) || host.endsWith(cookie.domain) : host === cookie.domain
      const pathOk = path === cookie.path || path.startsWith(cookie.path.endsWith("/") ? cookie.path : `${cookie.path}/`)
      return domainOk && pathOk
    })
    .sort((a, b) => b.path.length - a.path.length)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ")
}
