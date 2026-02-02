import React, { useEffect, useState } from 'react'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Button } from '@/components/ui/button'
import { 
  Bold, 
  Table as TableIcon, 
  Heading1, 
  Loader2, 
  Save, 
  Plus, 
  Trash2, 
  ChevronRight,
  Type
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { toast } from "sonner"

// 初始化 Turndown 实例（用于 HTML 转 Markdown）
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})

interface LayoutProps {
  children?: React.ReactNode;
  workspace: {
    name: string;
    path: string;
    files: Array<{ name: string; path: string }>;
  };
}

export default function Layout({ children, workspace }: LayoutProps): React.JSX.Element {
  const [isReading, setIsReading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell
    ],
    editorProps: {
      attributes: {
        // 使用 Tailwind Typography (prose) 渲染基础样式
        class: 'prose prose-slate max-w-none focus:outline-none px-8 py-12 min-h-[500px]',
      },
    },
  })

  // --- 核心功能：保存内容 ---
  const handleSave = async () => {
    if (!editor || !activeFilePath || isSaving) return

    const fileName = activeFilePath.split(/[/\\]/).pop()
    setIsSaving(true)

    // 使用 Sonner 的 Promise 模式实现优雅反馈
    toast.promise(async () => {
      const html = editor.getHTML()
      const markdown = turndownService.turndown(html)
      const success = await window.electronAPI.saveContent(activeFilePath, markdown)
      if (!success) throw new Error("Save failed")
    }, {
      loading: `正在保存 ${fileName}...`,
      success: () => {
        setIsSaving(false)
        return '保存成功'
      },
      error: () => {
        setIsSaving(false)
        return '保存失败，请检查文件权限'
      }
    })
  }

  // 快捷键支持 (Cmd/Ctrl + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editor, activeFilePath, isSaving])

  // --- 核心功能：读取并加载文件 ---
  const loadFile = async (path: string) => {
    setIsReading(true)
    setActiveFilePath(path)
    try {
      const mdContent = await window.electronAPI.readContent(path)
      const htmlContent = await marked.parse(mdContent)
      editor?.commands.setContent(htmlContent)
    } catch (err) {
      toast.error('读取文件失败')
    } finally {
      setIsReading(false)
    }
  }

  // 初始加载第一个文件
  useEffect(() => {
    if (workspace.files.length > 0 && editor && !activeFilePath) {
      loadFile(workspace.files[0].path)
    }
  }, [workspace, editor])

  if (!editor) return <></>

  return (
    <SidebarProvider>
      <AppSidebar
        workspace={workspace}
        activePath={activeFilePath}
        onFileClick={loadFile}
      />

      <main className="relative flex flex-1 flex-col bg-[#fafafa]">
        {/* --- 顶部毛玻璃 Header --- */}
        <header className="sticky top-0 z-10 flex h-14 items-center border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            <SidebarTrigger className="hover:bg-slate-100" />
            <Separator orientation="vertical" className="mx-4 h-4" />
            <span className="text-slate-900 truncate max-w-[200px]">{workspace.name}</span>
            <span className="mx-2">/</span>
            <span className="text-blue-500 lowercase font-normal italic truncate max-w-[150px]">
              {activeFilePath?.split(/[/\\]/).pop() || 'Untitled'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSave} 
              disabled={isSaving}
              className="h-8 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Save className="h-3 w-3 mr-2 text-blue-500" />}
              SAVE (⌘S)
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto relative">
          <div className="mx-auto max-w-4xl w-full px-4">
            
            {/* --- 动态感应工具栏 --- */}
            <div className="sticky top-4 z-20 my-4 flex items-center gap-1 rounded-2xl border border-white bg-white/80 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ring-1 ring-black/[0.02] w-fit mx-auto transition-all">
              
              {/* 基础工具 */}
              <Button
                variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                size="sm" className="h-8 w-8 p-0"
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
                size="sm" className="h-8 w-8 p-0"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              >
                <Heading1 className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* 动态表格工具逻辑 */}
              {!editor.isActive('table') ? (
                // 不在表格内：显示插入表格按钮
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-slate-400"
                  onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                >
                  <TableIcon className="h-4 w-4" />
                </Button>
              ) : (
                // 在表格内：显示管理按钮
                <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-300">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-blue-500" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                    +COL
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-blue-500" onClick={() => editor.chain().focus().addRowAfter().run()}>
                    +ROW
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400/60 hover:text-red-500" onClick={() => editor.chain().focus().deleteTable().run()}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* 保存快捷按钮 */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className={`h-4 w-4 ${isSaving ? 'text-blue-500 animate-pulse' : 'text-slate-400'}`} />
              </Button>
            </div>

            {/* 编辑器主体 */}
            <div className={`transition-opacity duration-500 ${isReading ? 'opacity-30' : 'opacity-100'}`}>
              <EditorContent editor={editor} />
            </div>

            {children}
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}