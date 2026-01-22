import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '@/components/ui/button'
import { Bold } from 'lucide-react'

export default function Layout(): React.JSX.Element {
  const editor = useEditor({
    extensions: [StarterKit], // 加载基础包（段落、加粗、撤销等）
    content: '<p>你好，这是 TipTap！</p>'
  })

  if (!editor) return <></>

  return (
    <SidebarProvider>
      <AppSidebar />
      <main>
        <SidebarTrigger />
      </main>
      <div className="rounded-md p-4 flex-1">
        <div className="mb-4 flex gap-2 pb-2">
          <Button
            variant={editor.isActive('bold') ? 'default' : 'ghost'} // 动态高亮状态
            size="icon"
            onClick={() => editor.chain().focus().toggleBold().run()} // 绑定命令
          >
            <Bold className="h-4 w-4" />
          </Button>
          {/* 你可以继续加斜体、标题、表格按钮... */}
        </div>

        {/* 2. 编辑器内容区 */}
        <EditorContent editor={editor} className="min-h-[200px] outline-none border-none" />
      </div>
    </SidebarProvider>
  )
}
