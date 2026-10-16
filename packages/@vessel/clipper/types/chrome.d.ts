declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      id?: string
      tab?: tabs.Tab
      url?: string
    }
    const lastError: { message?: string } | undefined
    function getURL(path: string): string
    function sendMessage<M = any, R = any>(message: M, responseCallback?: (response: R) => void): Promise<R>
    const onMessage: {
      addListener(callback: (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => boolean | void | Promise<any>): void
      removeListener(callback: (...args: any[]) => void): void
    }
    const onInstalled: {
      addListener(callback: (details: { reason: string }) => void): void
    }
  }

  namespace tabs {
    interface Tab {
      id?: number
      index: number
      windowId: number
      highlighted: boolean
      active: boolean
      pinned: boolean
      url?: string
      title?: string
      favIconUrl?: string
      status?: string
      incognito: boolean
      width?: number
      height?: number
    }
    function query(queryInfo: { active?: boolean; currentWindow?: boolean; [key: string]: any }): Promise<Tab[]>
    function sendMessage<M = any, R = any>(tabId: number, message: M): Promise<R>
    function create(createProperties: { url?: string; active?: boolean }): Promise<Tab>
  }

  namespace scripting {
    interface ScriptInjection<Args extends any[], Result> {
      target: { tabId: number; allFrames?: boolean }
      func?: (...args: Args) => Result
      files?: string[]
      args?: Args
    }
    interface InjectionResult<T> {
      result: T
    }
    function executeScript<Args extends any[], Result>(injection: ScriptInjection<Args, Result>): Promise<InjectionResult<Result>[]>
  }

  namespace contextMenus {
    interface CreateProperties {
      id?: string
      title?: string
      contexts?: ("all" | "page" | "selection" | "link" | "image")[]
      onclick?: (info: any, tab?: tabs.Tab) => void
    }
    function create(createProperties: CreateProperties, callback?: () => void): string | number
    function removeAll(callback?: () => void): Promise<void>
    const onClicked: {
      addListener(callback: (info: { menuItemId: string | number; selectionText?: string; linkUrl?: string; pageUrl?: string }, tab?: tabs.Tab) => void): void
    }
  }

  namespace storage {
    interface StorageArea {
      get(keys?: string | string[] | Record<string, any> | null): Promise<Record<string, any>>
      set(items: Record<string, any>): Promise<void>
      remove(keys: string | string[]): Promise<void>
      clear(): Promise<void>
    }
    const local: StorageArea
    const sync: StorageArea
  }

  namespace downloads {
    interface DownloadOptions {
      url: string
      filename?: string
      conflictAction?: "uniquify" | "overwrite" | "prompt"
      saveAs?: boolean
    }
    function download(options: DownloadOptions): Promise<number>
  }

  namespace action {
    function setBadgeText(details: { text: string; tabId?: number }): Promise<void>
    function setBadgeBackgroundColor(details: { color: string | [number, number, number, number]; tabId?: number }): Promise<void>
  }
}
