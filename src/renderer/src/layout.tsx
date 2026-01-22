import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Button } from '@/components/ui/button'
import { Bold } from 'lucide-react'

export default function Layout(): React.JSX.Element {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true // 允许拖拽调整列宽
      }),
      TableRow,
      TableHeader,
      TableCell
    ], // 加载基础包（段落、加粗、撤销等）
    content: '<p>你好，这是 TipTap！</p>',
    onUpdate: ({ editor }) => {
      // 每次修改，获取最新的 JSON
      const json = editor.getJSON()
      console.log(json);
    },
  })

  if (!editor) return <></>

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 flex flex-col">
        <SidebarTrigger />
        <div className="mb-4 flex gap-2 pb-2">
          <Button
            variant={editor.isActive('bold') ? 'default' : 'ghost'} // 动态高亮状态
            size="icon"
            onClick={() => editor.chain().focus().toggleBold().run()} // 绑定命令
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            插入表格
          </Button>
          <Button onClick={() => editor.chain().focus().mergeCells().run()}>
            合并单元格
          </Button>
          <Button onClick={() => editor.chain().focus().splitCell().run()}>
            拆分单元格
          </Button>
        </div>

        {/* 2. 编辑器内容区 */}
        <EditorContent editor={editor} className="min-h-[200px] outline-none border-none" />
      </main>
    </SidebarProvider>
  )
}
