import Editor from "@monaco-editor/react"
import { loader } from "@monaco-editor/react" // 关键：loader 可以直接从 react 包导出
import * as monaco from "monaco-editor" // 引入核心包
import { useRef, useState, useCallback, useEffect } from "react"
import { toast } from "sonner"

loader.config({ monaco })

// function customJSONParse(text: string) {
//   return JSON.parse(text, (_, v) => (typeof v === "number" && !Number.isSafeInteger(v) ? BigInt(v) : v))
// }
function customJSONStringify(obj: any) {
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v))
}

export default function JSONCanvas({ activeFilePath }: any) {
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null) // 存储 monaco 实例
  const [jsonStr, setJsonStr] = useState<string>("") // 初始空字符串
  const [isLoading, setIsLoading] = useState(false)
  const currentFilePathRef = useRef<string>("")
  const isLoadingRef = useRef(false)

  // Editor 加载完成回调
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // 设置 JSON 校验选项（可选）
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
    })
  }

  // 读取文件
  const loadPathFile = useCallback(
    async (path: string) => {
      if (!path || currentFilePathRef.current === path) return
      if (isLoadingRef.current) {
        console.warn("已有加载任务，跳过")
        return
      }

      setIsLoading(true)
      isLoadingRef.current = true

      try {
        if (!(window as any).electronAPI) {
          throw new Error("electronAPI 不可用")
        }
        const fileContent = await (window as any).electronAPI.readContent(path)
        // 假设返回的是 JSON 字符串或对象
        const contentStr = typeof fileContent === "string" ? fileContent : customJSONStringify(fileContent || {})

        if (path === activeFilePath) {
          setJsonStr(contentStr)
          currentFilePathRef.current = path
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
    loadPathFile(activeFilePath)
  }, [activeFilePath, loadPathFile])

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2" />
            <p className="text-sm text-gray-600">正在读取文件...</p>
          </div>
        </div>
      )}
      <Editor
        className="flex-1"
        language="json"
        value={jsonStr}
        onMount={handleEditorDidMount}
        options={{
          readOnly: false,
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize: 14,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          renderWhitespace: "selection",
        }}
      />
    </>
  )
}
