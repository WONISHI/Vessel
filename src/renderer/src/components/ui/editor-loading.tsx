import { FileText } from "lucide-react"
import "./editor-loading.css"
export function EditorLoading({ kind = "code", label }: { kind?: "code" | "office"; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`editor-loading editor-loading-${kind}`}
    >
      <div
        aria-hidden="true"
        className="loading-skeleton"
      >
        {kind === "code" ? (
          <div className="loading-code-lines">
            {Array.from({ length: 18 }, (_, i) => (
              <div key={i}>
                <span>{i + 1}</span>
                <i
                  className="loading-shimmer"
                  style={{ width: `${[38, 62, 45, 72, 28, 54][i % 6]}%`, marginLeft: (i % 4) * 16 }}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="loading-office-toolbar">
              {Array.from({ length: 10 }, (_, i) => (
                <i
                  key={i}
                  className="loading-shimmer"
                />
              ))}
            </div>
            <div className="loading-office-paper">
              {Array.from({ length: 14 }, (_, i) => (
                <i
                  key={i}
                  className="loading-shimmer"
                  style={{ width: i % 4 === 0 ? "60%" : "100%" }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="loading-editor-overlay">
        {kind === "office" ? (
          <>
            <div className="loading-office-icon">
              <FileText />
            </div>
            <strong>正在加载 ONLYOFFICE</strong>
          </>
        ) : (
          <div className="loading-code-spinner" />
        )}
        <span>{label || (kind === "office" ? "正在准备本地编辑器，请稍候…" : "正在加载代码文件…")}</span>
        {kind === "office" && (
          <div className="loading-office-progress">
            <i />
          </div>
        )}
      </div>
    </div>
  )
}
