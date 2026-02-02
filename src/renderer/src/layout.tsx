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
import { Bold, Table as TableIcon, Heading1, Loader2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { marked } from 'marked' // 用于将 MD 转为 HTML

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

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none px-8 py-12 min-h-[500px]',
      },
    },
  })

  // 核心功能：读取工作区第一个文件并解析（或者监听侧边栏选择）
  useEffect(() => {
    console.log(workspace)
    const loadInitialFile = async () => {
      if (workspace.files.length > 0 && editor) {
        setIsReading(true)
        try {
          const mdContent = await window.electronAPI.readContent(workspace.files[0].path)
          const htmlContent = await marked.parse(mdContent)
          editor.commands.setContent(htmlContent)
        } catch (err) {
          console.error("解析文件失败", err)
        } finally {
          setIsReading(false)
        }
      }
    }
    loadInitialFile()
  }, [workspace, editor]) // 当工作区切换或编辑器初始化完成后触发

  if (!editor) return <></>

  return (
    <SidebarProvider>
      {/* 这里的 AppSidebar 需要接收 workspace.files 并绑定点击事件 */}
      <AppSidebar workspace={workspace} onFileClick={async (path) => {
        console.log('path', path)
        const md = await window.electronAPI.readContent(path)
        console.log('md', md)
        const html = await marked.parse(md)
        editor.commands.setContent(html)
      }} />

      <main className="relative flex flex-1 flex-col bg-[#fafafa]">
        {/* 顶部毛玻璃导航 */}
        <header className="sticky top-0 z-10 flex h-14 items-center border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl">
          <SidebarTrigger className="hover:bg-slate-100" />
          <Separator orientation="vertical" className="mx-4 h-4" />
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            <span>Workspace</span>
            <span className="text-slate-200">/</span>
            <span className="text-slate-900 truncate max-w-[200px]">{workspace.name}</span>
            {isReading && <Loader2 className="h-3 w-3 animate-spin ml-2 text-blue-500" />}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto relative">
          <div className="mx-auto max-w-4xl w-full">
            {/* 悬浮工具栏 */}
            <div className="sticky top-4 z-20 mx-8 flex items-center gap-1 rounded-2xl border border-white bg-white/80 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ring-1 ring-black/[0.02]">
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
              <Button
                variant="ghost" size="sm" className="h-8 w-8 p-0"
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* 编辑器内容 */}
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