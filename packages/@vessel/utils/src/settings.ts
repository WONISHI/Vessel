import type { AppSettings } from "@vessel/type"

export const defaultSettings: AppSettings = {
  searchEngine: "bing",
  proxyEnabled: false,
  externalScreenshot: true,
  externalPreview: true,
  monitorNavigation: false,
  globalSearchEnabled: false,
  ignoredFiles: ".obsidian, .git",
  name: "本地用户",
  email: "",
  avatar: "",
  theme: "light",
  font: "Plus Jakarta Sans",
  fontSize: 14,
  accent: "#16a34a",
  backup: {
    syncExcludeRules: "{folder:.vessel,node-modules,.git,.obsidian}",
    logEnabled: false,
    direction: "bidirectional",
    concurrency: 8,
    conflictStrategy: "keep-both",
    propagateDeletes: true,
    deleteThresholdPercent: 20,
    maxFileSizeMB: 0,
    syncOnSave: false,
    enabled: false,
    endpoint: "",
    accessKey: "",
    bucket: "",
    region: "us-east-1",
    prefix: "backups/",
    automatic: false,
    minutes: 10,
    hasSecret: false
  }
}

/** Parses ignored patterns. */
export function parseIgnoredPatterns(patternStr?: string): string[] {
  if (typeof patternStr !== "string" || !patternStr.trim() || patternStr.trim() === ".obsidian, .gut") {
    return [".obsidian", ".git"]
  }
  return patternStr
    .split(/[,，\n]+/)
    .map((s) => (s.trim() === ".gut" ? ".git" : s.trim()))
    .filter(Boolean)
}

/** Checks whether ignored entry. */
export function isIgnoredEntry(name: string, patterns: string[]): boolean {
  if (!name || !patterns.length) return false
  const lowerName = name.toLowerCase()
  for (const pattern of patterns) {
    const lowerPattern = pattern.toLowerCase()
    if (lowerName === lowerPattern) return true
    if (lowerPattern.startsWith("*") && lowerPattern.endsWith("*") && lowerPattern.length > 2) {
      if (lowerName.includes(lowerPattern.slice(1, -1))) return true
    } else if (lowerPattern.startsWith("*")) {
      if (lowerName.endsWith(lowerPattern.slice(1))) return true
    } else if (lowerPattern.endsWith("*")) {
      if (lowerName.startsWith(lowerPattern.slice(0, -1))) return true
    }
  }
  return false
}
