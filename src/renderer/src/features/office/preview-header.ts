type EditorConfig = { editorConfig?: { customization?: Record<string, unknown>; [key: string]: unknown }; [key: string]: unknown }
type EditorConstructor = new (...args: unknown[]) => object
const configured = new WeakSet<EditorConstructor>()

/** The SDK has no customization prop; supply the native compact-header option at construction. */
export function configureOfficePreviewHeader() {
  const api = (window as Window & { DocsAPI?: { DocEditor?: EditorConstructor } }).DocsAPI
  const original = api?.DocEditor
  if (!api || !original || configured.has(original)) return
  const compact = new Proxy(original, {
    construct(target, args, newTarget) {
      const config = (args[1] || {}) as EditorConfig
      const editorConfig = config.editorConfig || {}
      const next = { ...config, editorConfig: { ...editorConfig, customization: { ...editorConfig.customization, compactHeader: true } } }
      return Reflect.construct(target, [args[0], next, ...args.slice(2)], newTarget)
    }
  })
  configured.add(compact)
  api.DocEditor = compact
}
