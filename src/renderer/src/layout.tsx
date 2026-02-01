import React from 'react'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Button } from '@/components/ui/button'
import { Bold, Italic, Table as TableIcon, Heading1, List } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

// 显式定义 Props 接口，修复 children 类型报错
interface LayoutProps {
  children?: React.ReactNode;
  workspace: {
    name: string;
    path: string;
    files: any[];
  };
}

export default function Layout({ children, workspace }: LayoutProps): React.JSX.Element {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell
    ],
    content: '<h1 class="text-3xl font-bold">欢迎使用 Vessel</h1><p>开始书写...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none px-8 py-12 min-h-[500px]',
      },
    },
  })

  if (!editor) return <></>

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="relative flex flex-1 flex-col bg-[#fafafa]">
        {/* 顶部毛玻璃导航 */}
        <header className="sticky top-0 z-10 flex h-14 items-center border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl">
          <SidebarTrigger className="hover:bg-slate-100" />
          <Separator orientation="vertical" className="mx-4 h-4" />
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            <span>Workspace</span>
            <span className="text-slate-200">/</span>
            <span className="text-slate-900">{workspace.name}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl w-full">
            {/* 悬浮工具栏 */}
            <div className="sticky top-6 z-20 mx-8 my-4 flex items-center gap-1 rounded-2xl border border-white bg-white/80 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ring-1 ring-black/[0.02]">
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <EditorContent editor={editor} />
            </div>

            {/* 渲染来自 App.tsx 的子组件 */}
            {children}
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}