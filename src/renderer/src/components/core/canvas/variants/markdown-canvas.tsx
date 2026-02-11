import Vditor from "vditor"
import "vditor/dist/index.css"
import { ToolbarProps } from "@/components/core/toolbar/types"
import { useEffect, useRef, useState, useCallback } from "react"
import { toast } from "sonner"

export default function MarkdownCanvas({ activeFilePath }: ToolbarProps) {
  const [isLoading, setIsLoading] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const vditorInstanceRef = useRef<Vditor | null>(null)
  const [content, setContent] = useState<string>("")
  const isInitializedRef = useRef(false)

  const currentFilePathRef = useRef<string>("")

  const isLoadingRef = useRef(false)

  const safeDestroyEditor = useCallback(() => {
    if (vditorInstanceRef.current) {
      try {
        const vditor = vditorInstanceRef.current as any
        if (vditor?.vditor?.element) {
          vditorInstanceRef.current.destroy()
        }
      } catch (err) {
        console.warn("销毁编辑器时出错（可忽略）:", err)
      } finally {
        vditorInstanceRef.current = null
      }
    }
  }, [])

  const initEditor = useCallback(() => {
    if (isInitializedRef.current || !editorRef.current) return
    if (vditorInstanceRef.current) safeDestroyEditor()

    try {
      isInitializedRef.current = true
      const vditor = new Vditor(editorRef.current, {
        placeholder: "此处为话题内容……",
        lang: "zh_CN",
        theme: "classic",
        counter: { enable: true, type: "markdown" },
        preview: {
          delay: 0,
          hljs: { style: "monokai", lineNumber: true },
          markdown: { toc: true },
        },
        outline: { enable: true, position: "right" },
        value: content,
        tab: "\t",
        typewriterMode: true,
        toolbarConfig: { pin: true },
        cache: { enable: false },
        mode: "ir",
        toolbar: [
          "emoji",
          "headings",
          "bold",
          "italic",
          "strike",
          "link",
          "|",
          "list",
          "ordered-list",
          "check",
          "outdent",
          "indent",
          "|",
          "quote",
          "line",
          "code",
          "inline-code",
          "insert-before",
          "insert-after",
          "|",
          "table",
          "|",
          "undo",
          "redo",
          "|",
          "edit-mode",
          "code-theme",
          "export",
          {
            name: "more",
            toolbar: ["fullscreen", "both", "preview", "info", "help"],
          },
        ],
        input: (value: string) => setContent(value),
        after: () => console.log("Vditor 编辑器已准备就绪"),
      })
      vditorInstanceRef.current = vditor
    } catch (err) {
      console.error("初始化编辑器失败:", err)
      toast.error("编辑器初始化失败")
      isInitializedRef.current = false
    }
  }, [safeDestroyEditor])

  // ---------- 加载文件内容（带防并发和防重复）----------
  const loadPathFile = useCallback(
    async (path: string) => {
      // 防重复：已经加载过该文件，且没有强制刷新需求，直接跳过
      if (currentFilePathRef.current === path) {
        return
      }

      // 防并发：已有加载任务正在进行，跳过本次触发
      if (isLoadingRef.current) {
        console.warn("已有加载任务正在进行，跳过本次加载")
        return
      }

      setIsLoading(true)
      isLoadingRef.current = true

      try {
        if (!(window as any).electronAPI) {
          throw new Error("electronAPI 不可用")
        }

        const mdContent = await (window as any).electronAPI.readContent(path)

        // 加载完成后，如果路径未变，才更新状态
        if (path === activeFilePath) {
          setContent(mdContent || "")
          currentFilePathRef.current = path // 记录已加载路径

          if (vditorInstanceRef.current?.vditor) {
            vditorInstanceRef.current.setValue(mdContent || "")
          }
        }
      } catch (err: any) {
        console.error("读取文件失败:", err)
        toast.error(`读取文件失败: ${err.message || "未知错误"}`)
      } finally {
        setIsLoading(false)
        isLoadingRef.current = false
      }
    },
    [activeFilePath]
  )

  useEffect(() => {
    const timer = setTimeout(initEditor, 100)
    return () => {
      clearTimeout(timer)
      safeDestroyEditor()
      isInitializedRef.current = false
      currentFilePathRef.current = ""
    }
  }, [initEditor, safeDestroyEditor])

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined

    if (activeFilePath && currentFilePathRef.current !== activeFilePath) {
      timer = setTimeout(() => {
        loadPathFile(activeFilePath)
      }, 150)
    }

    // 路径为空时清空编辑器
    if (!activeFilePath) {
      setContent("")
      currentFilePathRef.current = ""
      if (vditorInstanceRef.current?.vditor) {
        vditorInstanceRef.current.setValue("")
      }
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [activeFilePath, loadPathFile])

  return (
    <div className="flex-1 overflow-hidden w-full flex justify-center bg-[#fafafa]">
      <div className={`relative overflow-hidden w-full bg-white shadow-sm border border-slate-200/60 rounded-sm p-5 cursor-text ${isLoading ? "opacity-30" : "opacity-100"}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2" />
              <p className="text-sm text-gray-600">正在读取文件...</p>
            </div>
          </div>
        )}
        <div ref={editorRef} className="!h-full" />
      </div>
    </div>
  )
}
