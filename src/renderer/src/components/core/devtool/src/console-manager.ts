import StackTrace, { type StackFrame } from "stacktrace-js"

export type ConsoleLevel = "log" | "info" | "warn" | "error"

export interface ConsoleSource {
  file: string
  fileName: string
  line: number
  column: number
  functionName?: string
  raw: string
}

export interface ConsoleRecord {
  id: string
  type: ConsoleLevel
  args: any[]
  timestamp: string
  time: string
  source?: ConsoleSource
}

export interface ConsoleManagerOptions {
  /**
   * 是否继续输出到原始 Console。
   */
  preserveOriginal?: boolean

  /**
   * 是否记录调用文件、行号、列号。
   */
  captureSource?: boolean

  /**
   * 是否异步使用 SourceMap 修正源码位置。
   *
   * 开启后会增加开销。
   */
  resolveSourceMap?: boolean

  /**
   * Console 输出前缀。
   */
  prefix?: string

  /**
   * 从调用栈中排除的函数名 / 文件名。
   */
  ignorePatterns?: string[]

  /**
   * 捕获日志回调。
   */
  onLog?: (record: ConsoleRecord) => void

  /**
   * SourceMap 解析完成后的回调。
   */
  onSourceUpdate?: (id: string, source: ConsoleSource | undefined) => void
}

type ConsoleMethod = (...args: any[]) => void

type OriginalConsole = {
  [key in ConsoleLevel]: ConsoleMethod
}

const DEFAULT_IGNORE_PATTERNS = ["ConsoleManager", "console-manager"]

export class ConsoleManager {
  private readonly options: ConsoleManagerOptions & {
    ignorePatterns: string[]
  }

  private readonly originalConsole: OriginalConsole

  private installed = false

  constructor(options: ConsoleManagerOptions = {}) {
    this.options = {
      preserveOriginal: true,
      captureSource: true,
      resolveSourceMap: false,
      prefix: "",
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      ...options
    }

    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console)
    }
  }

  install(): void {
    if (this.installed) {
      return
    }

    this.installed = true

    console.log = (...args) => {
      this.handle("log", args)
    }

    console.info = (...args) => {
      this.handle("info", args)
    }

    console.warn = (...args) => {
      this.handle("warn", args)
    }

    console.error = (...args) => {
      this.handle("error", args)
    }
  }

  uninstall(): void {
    if (!this.installed) {
      return
    }

    console.log = this.originalConsole.log
    console.info = this.originalConsole.info
    console.warn = this.originalConsole.warn
    console.error = this.originalConsole.error
    this.installed = false
  }

  isInstalled(): boolean {
    return this.installed
  }

  private handle(type: ConsoleLevel, args: any[]): void {
    const now = new Date()

    const record: ConsoleRecord = {
      id: this.createId(),
      type,
      args,
      timestamp: this.formatDateTime(now),
      time: this.formatTime(now),
      source: this.options.captureSource ? this.getSourceSync() : undefined
    }

    if (this.options.preserveOriginal) {
      this.printOriginal(record)
    }

    if (this.options.onLog) {
      this.options.onLog(record)
    }

    if (this.options.resolveSourceMap && record.source) {
      this.resolveSource(record)
    }
  }

  private printOriginal(record: ConsoleRecord): void {
    const original = this.originalConsole[record.type]
    const sourceText = record.source ? this.formatSource(record.source) : ""
    const prefix = this.options.prefix ? `[${this.options.prefix}]` : ""
    const meta = [prefix, `[${record.time}]`, sourceText ? `[${sourceText}]` : ""].filter(Boolean).join(" ")

    if (!meta) {
      original(...record.args)
      return
    }

    /**
     * 如果第一参数是字符串，
     * 把 meta 拼到第一参数前面，
     * 保留 %s / %d / %o 等 Console 格式化能力。
     */
    const firstArg = record.args[0]
    if (typeof firstArg === "string") {
      original(`${meta} ${firstArg}`, ...record.args.slice(1))
      return
    }
    original(meta, ...record.args)
  }

  private getSourceSync(): ConsoleSource | undefined {
    try {
      const stack = StackTrace.getSync({
        filter: (frame) => !this.isIgnoredFrame(frame)
      })
      const frame = stack.find((item) => !this.isIgnoredFrame(item))
      if (!frame) {
        return undefined
      }
      return this.toSource(frame)
    } catch {
      return undefined
    }
  }

  private async resolveSource(record: ConsoleRecord): Promise<void> {
    try {
      const stack = await StackTrace.get({
        filter: (frame) => !this.isIgnoredFrame(frame)
      })
      const frame = stack.find((item) => !this.isIgnoredFrame(item))
      if (!frame) {
        return
      }
      const source = this.toSource(frame)
      record.source = source
      if (this.options.onSourceUpdate) {
        this.options.onSourceUpdate(record.id, source)
      }
    } catch {
      // SourceMap 解析失败时
      // 保留同步解析的位置。
    }
  }

  private isIgnoredFrame(frame: StackFrame): boolean {
    const fileName = frame.fileName || ""
    const functionName = frame.functionName || ""
    return (this.options.ignorePatterns || []).some((pattern) => fileName.includes(pattern) || functionName.includes(pattern))
  }

  private toSource(frame: StackFrame): ConsoleSource | undefined {
    const file = frame.fileName
    if (!file) {
      return undefined
    }
    const line = Number(frame.lineNumber || 0)
    const column = Number(frame.columnNumber || 0)
    return {
      file,
      fileName: this.getFileName(file),
      line,
      column,
      functionName: frame.functionName || undefined,
      raw: frame.toString()
    }
  }

  private getFileName(file: string): string {
    const cleanFile = file.split("?")[0]
    return cleanFile.split("/").pop() || cleanFile
  }

  private formatSource(source: ConsoleSource): string {
    if (!source.line) {
      return source.fileName
    }

    return `${source.fileName}:${source.line}:${source.column}`
  }

  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    const seconds = String(date.getSeconds()).padStart(2, "0")
    const milliseconds = String(date.getMilliseconds()).padStart(3, "0")
    return `${hours}:${minutes}:${seconds}.${milliseconds}`
  }

  private formatDateTime(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day} ${this.formatTime(date)}`
  }

  private createId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export default ConsoleManager
