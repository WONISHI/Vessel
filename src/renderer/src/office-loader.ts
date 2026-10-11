let loading: Promise<void> | undefined
/** Load before mounting the SDK: its own loader neither retries nor recovers failed script tags. */
export function loadOfficeAPI(): Promise<void> {
  const api = () => (window as Window & { DocsAPI?: { DocEditor?: unknown } }).DocsAPI?.DocEditor
  if (api()) return Promise.resolve()
  return loading ||= (async () => {
    const url = "/office/v9.3.0.24-1/web-apps/apps/api/documents/api.js"
    let failure: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { cache: "no-store" })
        if (!response.ok) throw new Error(`DocsAPI 资源读取失败（HTTP ${response.status}），请重新安装完整的 Vessel 安装包`)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script")
          const timer = setTimeout(() => { script.remove(); reject(new Error("DocsAPI 加载超时")) }, 15000)
          script.src = url + "?attempt=" + attempt
          script.onload = () => { clearTimeout(timer); api() ? resolve() : reject(new Error("DocsAPI 文件不完整")) }
          script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error("DocsAPI 脚本加载失败，请检查本地安全软件是否拦截应用资源")) }
          document.head.append(script)
        })
        return
      } catch (error) { failure = error; if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))) }
    }
    throw failure
  })().catch(error => { loading = undefined; throw error })
}
