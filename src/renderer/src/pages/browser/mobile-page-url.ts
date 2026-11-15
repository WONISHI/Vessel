/** Only web URLs that do not point back to this device can be shared by QR code. */
export function mobilePageURL(value: string): string | undefined {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    const host = url.hostname.toLowerCase().replace(/\.$/, "")
    if (host === "localhost" || host.endsWith(".localhost") || host === "localhost.localdomain" || /^127\./.test(host) || host === "0.0.0.0" || host === "[::1]" || host === "[::]" || host.startsWith("[::ffff:7f") || host === "[::ffff:0:0]") return undefined
    return url.href
  } catch { return undefined }
}
