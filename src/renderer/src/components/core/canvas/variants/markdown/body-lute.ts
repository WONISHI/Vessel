/** Frontmatter is managed separately by DocumentProperties; body rules must stay horizontal rules. */
export function configureBodyLute(lute: unknown) {
  // The bundled Lute exposes this option, but Vditor omits it from its declaration.
  const parser = lute as { SetYamlFrontMatter?: (enabled: boolean) => void } | undefined
  parser?.SetYamlFrontMatter?.(false)
}
