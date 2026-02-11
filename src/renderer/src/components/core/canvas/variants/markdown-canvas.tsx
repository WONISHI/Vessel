import Vditor from "vditor"
import "vditor/dist/index.css"
import { ToolbarProps } from "@/components/core/toolbar/types"
import { useEffect, useRef, useState, useCallback } from "react"
import { toast } from "sonner"

export default function MarkdownCanvas({ activeFilePath }: ToolbarProps) {
  const [isReading, setIsReading] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const vditorInstanceRef = useRef<Vditor | null>(null)
  const [content, setContent] = useState<string>("")
  // const [_, setIsEditorReady] = useState(false)
  const isInitializedRef = useRef(false)

  // 安全的销毁编辑器实例
  const safeDestroyEditor = useCallback(() => {
    if (vditorInstanceRef.current) {
      try {
        const vditor = vditorInstanceRef.current as any
        if (vditor && vditor.vditor && vditor.vditor.element) {
          vditorInstanceRef.current.destroy()
        }
      } catch (err) {
        console.warn("销毁编辑器时出错（可忽略）:", err)
      } finally {
        vditorInstanceRef.current = null
        // setIsEditorReady(false)
      }
    }
  }, [])

  // 初始化编辑器 - 使用单例模式
  const initEditor = useCallback(() => {
    // 如果已经初始化或正在初始化，则跳过
    if (isInitializedRef.current || !editorRef.current) {
      return
    }

    // 清理之前的实例
    if (vditorInstanceRef.current) {
      safeDestroyEditor()
    }

    try {
      isInitializedRef.current = true

      const vditor = new Vditor(editorRef.current, {
        placeholder: "此处为话题内容……",
        lang: "zh_CN",
        theme: "classic",
        counter: {
          enable: true,
          type: "markdown",
        },
        preview: {
          delay: 0,
          hljs: {
            style: "monokai",
            lineNumber: true,
          },
          markdown: {
            toc: true,
          },
        },
        outline: {
          enable: true,
          position: "right",
        },
        value: content, // 设置初始内容
        tab: "\t",
        typewriterMode: true,
        toolbarConfig: {
          pin: true,
        },
        cache: {
          enable: false,
        },
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
        // 内容变化回调
        input: (value: string) => {
          setContent(value)
        },
        // 编辑器准备就绪回调
        after: () => {
          // setIsEditorReady(true)
          console.log("Vditor 编辑器已准备就绪")
        },
      })

      vditorInstanceRef.current = vditor
    } catch (err) {
      console.error("初始化编辑器失败:", err)
      toast.error("编辑器初始化失败")
      isInitializedRef.current = false
    }
  }, [content, safeDestroyEditor])

  // 加载文件内容
  const loadPathFile = useCallback(async (path: string) => {
    if (!path) {
      setContent("")
      return
    }

    setIsReading(true)
    try {
      // 通过 electronAPI 读取文件内容
      if (!(window as any).electronAPI) {
        throw new Error("electronAPI 不可用")
      }

      const mdContent = await (window as any).electronAPI.readContent(path)
      console.log("读取到的内容:", mdContent)

      // 更新内容状态
      setContent(mdContent || "")

      // 如果编辑器已就绪，直接设置内容
      if (vditorInstanceRef.current) {
        const vditor = vditorInstanceRef.current as any
        if (vditor && vditor.vditor) {
          // 使用 setTimeout 确保在下一个事件循环中设置内容
          setTimeout(() => {
            if (vditorInstanceRef.current) {
              vditorInstanceRef.current.setValue(mdContent || "")
            }
          }, 0)
        }
      }
    } catch (err: any) {
      console.error("读取文件失败:", err)
      toast.error(`读取文件失败: ${err.message || "未知错误"}`)
    } finally {
      setIsReading(false)
    }
  }, [])

  // 初始化编辑器（只运行一次）
  useEffect(() => {
    // 延迟初始化，确保 DOM 完全加载
    const timer = setTimeout(() => {
      initEditor()
    }, 100)

    return () => {
      clearTimeout(timer)
      safeDestroyEditor()
      isInitializedRef.current = false
    }
  }, [initEditor, safeDestroyEditor])

  // 监听 activeFilePath 变化，加载对应文件
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined

    if (activeFilePath) {
      timer = setTimeout(() => {
        loadPathFile(activeFilePath)
      }, 150)
    } else {
      // 清空编辑器内容
      setContent("")
      if (vditorInstanceRef.current) {
        vditorInstanceRef.current?.vditor && vditorInstanceRef.current.setValue("")
      }
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [activeFilePath, loadPathFile])

  // // 重新初始化编辑器的函数（如果需要）
  // const reinitializeEditor = useCallback(() => {
  //   isInitializedRef.current = false
  //   safeDestroyEditor()

  //   // 延迟重新初始化
  //   setTimeout(() => {
  //     initEditor()
  //   }, 200)
  // }, [initEditor, safeDestroyEditor])

  // // 防止快速多次点击导致的重复初始化
  // const debouncedReinitialize = useCallback(() => {
  //   let timeoutId: NodeJS.Timeout

  //   return () => {
  //     if (timeoutId) {
  //       clearTimeout(timeoutId)
  //     }
  //     timeoutId = setTimeout(() => {
  //       reinitializeEditor()
  //     }, 300)
  //   }
  // }, [reinitializeEditor])()

  return (
    <div className="flex-1 overflow-hidden w-full flex justify-center bg-[#fafafa]">
      {/* 纸张容器 */}
      <div className={`relative overflow-hidden w-full bg-white shadow-sm border border-slate-200/60 rounded-sm p-5 cursor-text ${isReading ? "opacity-30" : "opacity-100"}`}>
        {/* 加载指示器 */}
        {isReading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-sm text-gray-600">正在读取文件...</p>
            </div>
          </div>
        )}

        {/* 编辑器容器 */}
        <div ref={editorRef} className="!h-full"></div>
      </div>
    </div>
  )
}
