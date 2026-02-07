import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FileText, Folder, ChevronRight } from "lucide-react"
import Logo from '@/assets/logo.png'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState } from "react"
import { WorkspaceContext } from '@/layout/context/WorkspaceContext';
import { cn } from "@/lib/utils"
import TurndownService from 'turndown'
import { Markdown } from 'tiptap-markdown'
import { gfm } from 'turndown-plugin-gfm'
import { toast } from "sonner"

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
})

turndownService.use(gfm)

function NavItem({ node, activeFilePath, onFileClick }: any) {
    const active = node.path === activeFilePath

    // 1. 递归渲染需要 key，但在组件内部我们只关注当前节点的渲染
    // key 应该加在调用组件的地方

    if (node.type === 'file') {
        return (
            <SidebarMenuItem>
                <SidebarMenuButton
                    onClick={() => onFileClick(node.path)}
                    className={cn(
                        "h-9 transition-all hover:bg-white text-slate-500",
                        active && "bg-white text-blue-600 shadow-sm font-medium"
                    )}
                >
                    <FileText className={cn("h-3.5 w-3.5", active ? "text-blue-500" : "text-slate-400")} />
                    <span className="truncate text-xs">{node.name}</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        )
    }
    return (
        <SidebarMenuItem className="w-[calc(100%_-_0.5em)]">
            <Collapsible className="group/collapsible">
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="h-9 hover:bg-white text-slate-600">
                        <Folder className="h-3.5 w-3.5 text-blue-400/70" />
                        <span className="truncate text-xs font-bold">{node.name}</span>
                        <ChevronRight className="ml-auto h-3 w-3 transition-transform text-slate-300 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenu className="w-[calc(100%_-_0.25em)] ml-3 border-l border-slate-200/60 pl-1">
                        {node.children?.map((child: any) => (
                            <NavItem
                                key={child.path}
                                activeFilePath={activeFilePath}
                                node={child}
                                onFileClick={onFileClick}
                            />
                        ))}
                    </SidebarMenu>
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuItem>
    )
}

export default function LayoutSide({ workspace, children }: any) {
    const [activeFilePath, setActiveFilePath] = useState<string | null>('')
    const [fileType, setFileType] = useState<string>('')
    const [isSaving, setIsSaving] = useState(false)

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Table.configure({ resizable: true }),
            TableRow, TableHeader, TableCell,
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            Placeholder.configure({ placeholder: '开始输入...' }),
            Markdown.configure({
                html: true, // 必须开启，允许 Markdown 混合 HTML
                transformPastedText: true,
                transformCopiedText: true,
                extensions: [
                    {
                        // 🟢 背景色 (Highlight) -> 转为 <mark>
                        name: 'highlight',
                        on: { mark: 'highlight' },
                        serialize: {
                            open: (mark: any) => mark.attrs.color ? `<mark style="background-color: ${mark.attrs.color}">` : '<mark>',
                            close: '</mark>',
                        },
                    },
                    {
                        // 🟢 文字颜色 (TextStyle) -> 转为 <span>
                        name: 'textStyle',
                        on: { mark: 'textStyle' },
                        serialize: {
                            open: (mark: any) => mark.attrs.color ? `<span style="color: ${mark.attrs.color}">` : '<span>',
                            close: '</span>',
                        },
                    },
                ],
            } as any)
        ],
        editorProps: {
            attributes: {
                class: 'prose prose-slate prose-sm sm:prose-base max-w-none focus:outline-none min-h-[calc(100vh-200px)]',
            },
        },
    })

    const onFileClick = (path: string) => {
        setActiveFilePath(path)
    }

    const onSave = () => {
        if (!editor || !activeFilePath || isSaving) return
        const fileName = activeFilePath.split(/[/\\]/).pop()

        toast.promise(async () => {
            const html = editor.getHTML()
            const markdown = turndownService.turndown(html)
            console.log(markdown)
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

    useEffect(() => {
        if (workspace?.files?.length > 0 && !activeFilePath) {
            const findFile = (nodes: any[]) => {
                for (const node of nodes) {
                    if (node.type === 'file') return node;
                    if (node.children) {
                        const found = findFile(node.children);
                        if (found) return found;
                    }
                }
                return null;
            }
            const _activeFilePath = findFile(workspace.files);
            console.log('_activeFilePath',_activeFilePath)
            if (_activeFilePath) {
                const ext = _activeFilePath.path.split('.').pop()
                setFileType(ext)
                setActiveFilePath(_activeFilePath.path)
            }
        }
    }, [workspace])

    return (
        //@ts-ignore
        <WorkspaceContext.Provider value={{ workspace, activeFilePath, editor, fileType, onSave }}>
            <Sidebar variant="floating" className="border-r-0 bg-slate-50/50">
                <SidebarHeader className="p-4 flex flex-row items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center p-1.5">
                        <img src={Logo} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col overflow-hidden text-left leading-tight">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspace</span>
                        <span className="truncate text-sm font-bold text-slate-800">{workspace.name}</span>
                    </div>
                </SidebarHeader>
                <SidebarContent className="px-2 mt-2">
                    <SidebarMenu>
                        {workspace.files.map((node: any) => (
                            <NavItem
                                key={node.path}
                                activeFilePath={activeFilePath}
                                node={node}
                                onFileClick={onFileClick}
                            />
                        ))}
                    </SidebarMenu>
                </SidebarContent>
            </Sidebar>
            {/* 这里的 children 就是 LayoutMain */}
            {children}
        </WorkspaceContext.Provider>
    )
}