/** Detect display syntax without evaluating code or modifying clipboard content. */
export function transitTextLanguage(content: string): string {
  try { JSON.parse(content); return "json" } catch { /* Continue with conservative syntax hints. */ }
  if (/^\s*(?:import\s|export\s|(?:async\s+)?function\s|(?:const|let|var)\s)/m.test(content)) return /\b(?:interface|type)\s+\w+|:\s*(?:string|number|boolean|Promise)[\s<;,)]/.test(content) ? "typescript" : "javascript"
  if (/^\s*<\?xml|^\s*<[a-z][\s\S]*>/i.test(content)) return "html"
  if (/^\s*(?:#{1,6}\s|```)/m.test(content)) return "markdown"
  return "plaintext"
}

