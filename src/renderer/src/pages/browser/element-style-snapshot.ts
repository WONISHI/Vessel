export type StyleRow = [string, string]
export interface ElementStyleSnapshot {
  element?: { tagName: string; attributes: Record<string, string>; text: string; outerHTML: string; bounds: { x: number; y: number; width: number; height: number } }
  user: StyleRow[]
  system: StyleRow[]
  unreadableSheets: boolean
}

/** CSSOM exposes authored rules, but not the browser's UA stylesheet or protected cross-origin sheets. */
export function readElementStyles(element: Element): ElementStyleSnapshot {
  const view = element.ownerDocument.defaultView!
  const computed = view.getComputedStyle(element)
  const names = Array.from(computed)
  const authored = new Set<string>()
  const inherited = /^(?:--|color$|font|text|line-|letter-|word-|white-space|hyphens|tab-size|writing-mode|direction|unicode-bidi|visibility$|cursor$|list-style|border-collapse$|border-spacing$|caption-side$|empty-cells$|orphans$|widows$|quotes$|fill|stroke)/
  let unreadableSheets = false
  const seen = new Set<CSSStyleSheet>()
  const rules: CSSStyleRule[] = []
  const mediaMatches = (text: string) => !text || !view.matchMedia || view.matchMedia(text).matches
  const visitSheet = (sheet: CSSStyleSheet) => {
    if (seen.has(sheet) || sheet.disabled || !mediaMatches(sheet.media?.mediaText)) return
    seen.add(sheet)
    try { visitRules(sheet.cssRules) } catch { unreadableSheets = true }
  }
  const visitRules = (items: CSSRuleList) => {
    for (const rule of Array.from(items)) {
      if (rule.type === 1) rules.push(rule as CSSStyleRule)
      else if (rule.type === 3) {
        const imported = rule as CSSImportRule
        if (imported.styleSheet && mediaMatches(imported.media.mediaText)) visitSheet(imported.styleSheet)
      } else if ("cssRules" in rule) {
        if (rule.type === 4 && !mediaMatches((rule as CSSMediaRule).conditionText)) continue
        if (rule.constructor.name === "CSSSupportsRule" && view.CSS?.supports && !view.CSS.supports((rule as CSSSupportsRule).conditionText)) continue
        visitRules((rule as CSSGroupingRule).cssRules)
      }
    }
  }
  const scope = element.getRootNode() as Document | ShadowRoot
  const sheets = Array.from(scope.styleSheets || [])
  for (const sheet of [...sheets, ...(scope.adoptedStyleSheets || [])]) visitSheet(sheet)
  let node: Element | null = element
  while (node) {
    const isSelf = node === element
    const addDeclaration = (style: CSSStyleDeclaration) => {
      const all = style.getPropertyValue("all")
      for (const name of names) {
        if (!isSelf && !inherited.test(name)) continue
        // Querying longhands also recognizes authored shorthands such as margin and font.
        if (style.getPropertyValue(name) || (all && !name.startsWith("--") && !["direction", "unicode-bidi"].includes(name))) authored.add(name)
      }
      for (const name of Array.from(style)) {
        if ((isSelf || inherited.test(name)) && computed.getPropertyValue(name)) authored.add(name)
      }
    }
    if ("style" in node) addDeclaration((node as HTMLElement).style)
    for (const rule of rules) {
      try { if (node.matches(rule.selectorText)) addDeclaration(rule.style) } catch { /* Unsupported selectors or pseudo-elements do not match this element. */ }
    }
    node = node.parentElement
  }
  const result: ElementStyleSnapshot = { user: [], system: [], unreadableSheets }
  for (const name of new Set([...names, ...authored])) {
    const value = computed.getPropertyValue(name).trim()
    ;(authored.has(name) ? result.user : result.system).push([name, value])
  }
  const rect = element.getBoundingClientRect()
  result.element = {
    tagName: element.tagName.toLowerCase(),
    attributes: Object.fromEntries(Array.from(element.attributes, attribute => [attribute.name, attribute.value])),
    text: element.textContent || "",
    outerHTML: element.outerHTML,
    bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }
  return result
}
