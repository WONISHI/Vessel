import { useEffect, useState, Component, type ReactNode, type ErrorInfo } from "react"
import { useRouteError } from "react-router-dom"
import { AlertTriangle, RefreshCw, RotateCcw, X, Copy, Check, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CrashFallbackViewProps {
  error?: unknown
  onReset?: () => void
}

export function CrashFallbackView({ error, onReset }: CrashFallbackViewProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (error as any)?.statusText || "发生了未预期的页面错误"

  const errorStack = error instanceof Error ? error.stack : ""

  useEffect(() => {
    // 立即向主进程标记当前处于崩溃状态
    void window.electronAPI.reportCrash?.(true)

    // 崩溃状态下如果收到主进程关闭请求（如菜单退出或红点），直接退出，绝不二次确认
    const cleanup = window.electronAPI.onRequestClose?.(() => {
      void window.electronAPI.confirmQuit?.()
    })

    // 快捷键支持：按 Cmd+R / Ctrl+R / F5 立即重新加载
    const onKeyDown = (e: KeyboardEvent) => {
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r") || e.key === "F5") {
        e.preventDefault()
        handleReload()
      }
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      cleanup?.()
      window.removeEventListener("keydown", onKeyDown)
      void window.electronAPI.reportCrash?.(false)
    }
  }, [])

  const handleReload = () => {
    void window.electronAPI.reportCrash?.(false)
    onReset?.()
    if (window.electronAPI.reloadWindow) {
      void window.electronAPI.reloadWindow()
    } else {
      window.location.reload()
    }
  }

  const handleRelaunch = () => {
    void window.electronAPI.reportCrash?.(false)
    if (window.electronAPI.relaunchApp) {
      void window.electronAPI.relaunchApp()
    } else {
      window.location.reload()
    }
  }

  const handleQuit = () => {
    void window.electronAPI.confirmQuit?.()
  }

  const handleCopy = () => {
    const fullText = `[Vessel Error Report]\nMessage: ${errorMessage}\n\nStack:\n${errorStack || "No stack trace available"}`
    void navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const isMac = navigator.platform.includes("Mac")

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground select-none">
      {/* 顶部标题栏区域（保留原生红黄绿按键位置与窗口拖拽） */}
      <div
        className={`flex h-10 w-full shrink-0 items-center justify-between border-b border-border/40 bg-muted/30 px-4 drag-region ${
          isMac ? "pl-20" : ""
        }`}
      >
        <span className="text-xs font-medium text-muted-foreground">Vessel - 应用异常</span>
        <div className="flex items-center gap-1.5 no-drag">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] text-muted-foreground">页面已暂停</span>
        </div>
      </div>

      {/* 页面内容居中容器 */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 no-drag overflow-y-auto">
        <div className="flex w-full max-w-lg flex-col items-center text-center space-y-5">
          {/* 异常图标 */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-8 ring-destructive/5">
            <AlertTriangle className="h-8 w-8" />
          </div>

          {/* 标题与描述 */}
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">应用遇到异常</h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              页面加载或组件运行发生错误。您可以直接重新加载恢复，或重启应用。
            </p>
          </div>

          {/* 简要错误原因 */}
          <div className="w-full rounded-lg border border-destructive/20 bg-destructive/5 p-3.5 text-left">
            <p className="font-mono text-xs text-destructive break-all leading-relaxed select-text">
              {errorMessage}
            </p>
          </div>

          {/* 详细堆栈折叠 */}
          {errorStack && (
            <div className="w-full text-left space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  <span>{showDetails ? "收起详细信息" : "展开错误堆栈"}</span>
                </button>
                {showDetails && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? "已复制" : "复制错误"}</span>
                  </button>
                )}
              </div>

              {showDetails && (
                <pre className="max-h-40 w-full overflow-auto rounded-md border border-border/50 bg-muted/60 p-3 font-mono text-[11px] leading-snug text-muted-foreground select-text whitespace-pre-wrap break-all">
                  {errorStack}
                </pre>
              )}
            </div>
          )}

          {/* 操作按钮区 */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button onClick={handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              重新加载
            </Button>
            <Button variant="outline" onClick={handleRelaunch} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              重启应用
            </Button>
            <Button
              variant="ghost"
              onClick={handleQuit}
              className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
              退出应用
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground/70">
            按 <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">Cmd + R</kbd> 即可快速重新加载页面
          </p>
        </div>
      </div>
    </div>
  )
}

/** React Router 专用的 ErrorElement */
export function RouterCrashFallback() {
  const error = useRouteError()
  return <CrashFallbackView error={error} />
}

/** 全局 React ErrorBoundary 组件 */
interface GlobalErrorBoundaryProps {
  children: ReactNode
}

interface GlobalErrorBoundaryState {
  hasError: boolean
  error: unknown
}

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: unknown): GlobalErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("GlobalErrorBoundary 捕获异常:", error, info)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <CrashFallbackView error={this.state.error} onReset={this.handleReset} />
    }
    return this.props.children
  }
}
