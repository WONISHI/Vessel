import Vditor from "vditor"
import "vditor/dist/index.css"
import "@/components/core/canvas/variants/markdown/index.css"
import { useEffect, useRef, useState, useCallback } from "react"
import { toast } from "sonner"

export default function MarkdownCanvas({ activeFilePath }: any) {
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
        console.warn("Destroy editor error (ignorable):", err)
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
        placeholder: "Start writing...",
        lang: "zh_CN",
        theme: "classic",
        counter: { enable: true, type: "markdown" },
        preview: {
          delay: 0,
          hljs: { style: "monokai", lineNumber: true },
          markdown: { toc: true }
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
            toolbar: ["fullscreen", "both", "preview", "info", "help"]
          }
        ],
        input: (value: string) => setContent(value),
        after: () => console.log("Vditor editor ready")
      })
      vditorInstanceRef.current = vditor
    } catch (err) {
      console.error("Init editor error:", err)
      toast.error("Editor init failed")
      isInitializedRef.current = false
    }
  }, [safeDestroyEditor])

  const loadPathFile = useCallback(
    async (path: string) => {
      if (currentFilePathRef.current === path) {
        return
      }

      if (isLoadingRef.current) {
        console.warn("Loading in progress, skipping")
        return
      }

      setIsLoading(true)
      isLoadingRef.current = true

      try {
        if (!(window as any).electronAPI) {
          throw new Error("electronAPI not available")
        }

        const mdContent = await (window as any).electronAPI.readContent(path)

        if (path === activeFilePath) {
          setContent(mdContent || "")
          currentFilePathRef.current = path

          if (vditorInstanceRef.current?.vditor) {
            vditorInstanceRef.current.setValue(mdContent || "")
          }
        }
      } catch (err: any) {
        console.error("Read file error:", err)
        toast.error(`Read file failed: ${err.message || "Unknown error"}`)
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
  }, [activeFilePath, initEditor, loadPathFile])

  return (
    <div className="flex-1 overflow-hidden w-full flex justify-center bg-zinc-50/50">
      <div className={`relative overflow-hidden w-full bg-white shadow-sm border border-zinc-200/60 rounded-sm p-5 cursor-text ${isLoading ? "opacity-50" : "opacity-100"}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
              <p className="text-sm text-zinc-500">Reading file...</p>
            </div>
          </div>
        )}
        <div
          ref={editorRef}
          className="!h-full"
        />
      </div>
    </div>
  )
}
