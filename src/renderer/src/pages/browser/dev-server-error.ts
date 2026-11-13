/** Surface actionable local development failures without treating warnings as fatal. */
export function devServerError(url: string, message: string, level: number) {
  try {
    const target = new URL(url)
    if (!['http:', 'https:'].includes(target.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) return undefined
  } catch { return undefined }
  if ((level >= 3 && /(?:uncaught|failed to (?:fetch|load|resolve)|internal server error|\b500\b|syntaxerror|typeerror|referenceerror)/i.test(message)) || /\[vite\].*(?:server connection lost|failed to connect)/i.test(message)) return message.slice(0, 12000)
  return undefined
}
