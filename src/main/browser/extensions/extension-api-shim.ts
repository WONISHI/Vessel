/**
 * Fills Chrome extension APIs that Electron does not implement (`chrome.management`, `chrome.proxy`,
 * `chrome.notifications`, `chrome.idle`, `chrome.alarms`, `chrome.webRequest.onAuthRequired`) and
 * preserves the canonical CRX `runtime_id` when unpacked extensions lack a `manifest.json` `"key"`.
 * Must stay self-contained: it is serialized and executed inside extension pages and background pages.
 */
export function installExtensionApiShim(tabBridgeToken?: string) {
  const scope = globalThis as unknown as {
    chrome?: Record<string, any>
    fetch?: typeof fetch
    XMLHttpRequest?: typeof XMLHttpRequest
    __vesselExtensionShim?: boolean
    __vesselExtensionShimToken?: string
    open?: (url: string, target?: string) => unknown
    clients?: { openWindow(url: string): Promise<unknown> }
  }
  const chrome = scope.chrome
  if (!chrome?.runtime?.id || (scope.__vesselExtensionShim && (!tabBridgeToken || scope.__vesselExtensionShimToken === tabBridgeToken))) return
  scope.__vesselExtensionShimToken = tabBridgeToken
  scope.__vesselExtensionShim = true

  /** Creates an inert Chrome event object. */
  const event = () => ({ addListener() {}, removeListener() {}, hasListener: () => false, hasListeners: () => false })

  /** Resolves through both the callback and Promise styles used by MV2/MV3 extensions. */
  const reply = <T,>(value: T, callback?: unknown) => {
    if (typeof callback === "function") setTimeout(() => (callback as (value: T) => void)(value), 0)
    return Promise.resolve(value)
  }

  const manifest = chrome.runtime.getManifest?.() || {}
  const runtimeId = chrome.runtime.id
  // Keep request identity identical to Chromium's extension Origin. CRX identity belongs
  // in manifest.key at import time, never in a rewritten authentication request body.
  if (manifest.author === "mzkeapp@gmail.com" || /iguge/i.test(String(manifest.homepage_url || ""))) {
    if (typeof scope.fetch === "function") {
      const originalFetch = scope.fetch.bind(scope)
      scope.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const pending = originalFetch(input, init)
        // Report only fixed endpoint names and booleans; never account, code, token or response bodies.
        if (tabBridgeToken && typeof init?.body === "string") {
          let endpoint = ""
          try { endpoint = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).pathname } catch {}
          if (["/page/muser/login", "/chromeext/email/sendcode_v2", "/chromeext/v2/email_login"].includes(endpoint)) {
            let fields: Record<string, unknown> = {}
            try { fields = JSON.parse(init.body) } catch {}
            void pending.then(async (response) => {
              let data: Record<string, unknown> = {}
              try { data = await response.clone().json() } catch {}
              await originalFetch("http://127.0.0.1:35678/api/extension-login-diagnostic", {
                method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tabBridgeToken}` },
                body: JSON.stringify({ endpoint, status: response.status, tokenPresent: Boolean(fields.token), runtimeIdMatched: fields.runtime_id === runtimeId,
                  formTokenPresent: Object.keys(fields).some((key) => /csrf|nonce|(?:form|verify).*token/i.test(key) && Boolean(fields[key])),
                  success: data.result === "ok", invalidToken: typeof data.msg === "string" && /token.*invalid|invalid.*token/i.test(data.msg) })
              })
            }).catch(() => {})
          }
        }
        return pending
      }
    }
  }

  /** Describes the current extension in chrome.management's ExtensionInfo shape. */
  const self = () => ({
    id: chrome.runtime.id,
    name: manifest.name || "",
    version: manifest.version || "",
    enabled: true,
    type: "extension",
    installType: "normal",
    mayDisable: true,
    permissions: manifest.permissions || [],
    hostPermissions: [],
    offlineEnabled: false,
    description: manifest.description || ""
  })

  const management = chrome.management || {}
  if (typeof management.getAll !== "function") management.getAll = (callback?: unknown) => reply([self()], callback)
  if (typeof management.get !== "function") management.get = (id: string, callback?: unknown) => reply(id === chrome.runtime.id ? self() : undefined, callback)
  if (typeof management.getSelf !== "function") management.getSelf = (callback?: unknown) => reply(self(), callback)
  if (typeof management.setEnabled !== "function") management.setEnabled = (_id: string, _enabled: boolean, callback?: unknown) => reply(undefined, callback)
  for (const name of ["onInstalled", "onUninstalled", "onEnabled", "onDisabled"]) management[name] ||= event()
  chrome.management = management

  const tabs = chrome.tabs || {}
  if (typeof tabs.create !== "function") tabs.create = (details: { url?: string }, callback?: unknown) => {
    const url = new URL(details.url || "about:blank", `chrome-extension://${chrome.runtime.id}/`).href
    if (!/^(https?:|chrome-extension:|about:)/.test(url)) return Promise.reject(new Error("不支持的标签页地址"))
    if (scope.open) {
      scope.open(url, "_blank")
      return reply({ url, active: true }, callback)
    }
    if (tabBridgeToken && scope.fetch) return scope.fetch("http://127.0.0.1:35678/api/extension-tab", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tabBridgeToken}` }, body: JSON.stringify({ url })
    }).then((response) => {
      if (!response.ok) throw new Error("Vessel 无法打开扩展标签页")
      return reply({ url, active: true }, callback)
    })
    return Promise.reject(new Error("当前扩展上下文无法打开标签页"))
  }
  chrome.tabs = tabs

  const proxyRequest = async (details: Record<string, unknown>) => {
    if (!tabBridgeToken || !scope.fetch) throw new Error("扩展代理桥接未就绪，请重启 Vessel")
    const response = await scope.fetch("http://127.0.0.1:35678/api/extension-proxy", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tabBridgeToken}` }, body: JSON.stringify(details)
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "扩展代理配置失败")
    return data
  }
  const proxyCall = (details: Record<string, unknown>, callback?: unknown) => {
    const pending = proxyRequest(details)
    if (typeof callback !== "function") return pending
    void pending.then((data) => callback(data), (error) => {
      chrome.runtime.lastError = { message: String(error) }
      try { callback() } finally { delete chrome.runtime.lastError }
    })
    return undefined
  }
  const proxy = chrome.proxy || {}
  // Replace inert/native partial APIs as Electron does not implement chrome.proxy.
  proxy.settings = {
    get: (_details: unknown, callback?: unknown) => proxyCall({ action: "get" }, callback),
    set: (details: { value?: unknown; scope?: string }, callback?: unknown) => proxyCall({ action: "set", value: details.value, scope: details.scope }, callback),
    clear: (_details: unknown, callback?: unknown) => proxyCall({ action: "clear" }, callback),
    onChange: event()
  }
  proxy.onProxyError ||= event()
  chrome.proxy = proxy

  const notifications = chrome.notifications || {}
  if (typeof notifications.create !== "function") {
    notifications.create = (idOrOptions: unknown, maybeOptions?: unknown, maybeCallback?: unknown) => {
      const id = typeof idOrOptions === "string" ? idOrOptions : `notification_${Date.now()}`
      const callback = typeof idOrOptions === "string" ? maybeCallback : maybeOptions
      return reply(id, callback)
    }
  }
  if (typeof notifications.clear !== "function") notifications.clear = (_id: string, callback?: unknown) => reply(true, callback)
  if (typeof notifications.update !== "function") notifications.update = (_id: string, _options: unknown, callback?: unknown) => reply(true, callback)
  if (typeof notifications.getAll !== "function") notifications.getAll = (callback?: unknown) => reply({}, callback)
  for (const name of ["onClicked", "onClosed", "onButtonClicked"]) notifications[name] ||= event()
  chrome.notifications = notifications

  const idle = chrome.idle || {}
  if (typeof idle.queryState !== "function") idle.queryState = (_interval: number, callback?: unknown) => reply("active", callback)
  if (typeof idle.setDetectionInterval !== "function") idle.setDetectionInterval = () => {}
  idle.onStateChanged ||= event()
  chrome.idle = idle

  const alarms = chrome.alarms || {}
  if (typeof alarms.create !== "function") alarms.create = (_name?: unknown, _info?: unknown, callback?: unknown) => reply(undefined, callback)
  if (typeof alarms.clear !== "function") alarms.clear = (_name?: unknown, callback?: unknown) => reply(true, callback)
  if (typeof alarms.clearAll !== "function") alarms.clearAll = (callback?: unknown) => reply(true, callback)
  if (typeof alarms.get !== "function") alarms.get = (_name?: unknown, callback?: unknown) => reply(undefined, callback)
  if (typeof alarms.getAll !== "function") alarms.getAll = (callback?: unknown) => reply([], callback)
  alarms.onAlarm ||= event()
  chrome.alarms = alarms

  for (const key of ["action", "browserAction"] as const) {
    const action = chrome[key] || {}
    if (typeof action.setPopup !== "function") action.setPopup = (_details: unknown, callback?: unknown) => reply(undefined, callback)
    if (typeof action.setBadgeText !== "function") action.setBadgeText = (_details: unknown, callback?: unknown) => reply(undefined, callback)
    if (typeof action.setBadgeBackgroundColor !== "function") action.setBadgeBackgroundColor = (_details: unknown, callback?: unknown) => reply(undefined, callback)
    if (typeof action.setTitle !== "function") action.setTitle = (_details: unknown, callback?: unknown) => reply(undefined, callback)
    if (typeof action.setIcon !== "function") action.setIcon = (_details: unknown, callback?: unknown) => reply(undefined, callback)
    action.onClicked ||= event()
    chrome[key] = action
  }

  const webRequest = chrome.webRequest || {}
  if (tabBridgeToken) {
    const listeners = new Set<(...args: any[]) => any>()
    let polling = false
    const handled = new Set<string>()
    const poll = async () => {
      if (!listeners.size) { polling = false; return }
      try {
        const requests = await proxyRequest({ action: "auth-poll" })
        for (const details of requests) {
          if (handled.has(details.requestId)) continue
          handled.add(details.requestId)
          if (handled.size > 256) handled.delete(handled.values().next().value!)
          let answered = false
          const answer = (result: any) => {
            if (answered) return
            answered = true
            void proxyRequest({ action: "auth-reply", requestId: details.requestId, authCredentials: result?.authCredentials }).catch(() => {})
          }
          for (const listener of listeners) {
            try {
              const result = listener(details, answer)
              if (result?.then) void result.then(answer).catch(() => {})
              else if (result) answer(result)
            } catch { /* A faulty listener must not stop subsequent auth requests. */ }
          }
        }
      } catch { /* Retry while an auth listener remains registered. */ }
      setTimeout(poll, 500)
    }
    webRequest.onAuthRequired = {
      addListener(listener: (...args: any[]) => any) { listeners.add(listener); if (!polling) { polling = true; void poll() } },
      removeListener(listener: (...args: any[]) => any) { listeners.delete(listener) },
      hasListener: (listener: (...args: any[]) => any) => listeners.has(listener),
      hasListeners: () => listeners.size > 0
    }
  } else webRequest.onAuthRequired ||= event()
  chrome.webRequest = webRequest
}
