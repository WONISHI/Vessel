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
import { useEffect, useState } from "react"
import { WorkspaceContext } from '@/layout/context/WorkspaceContext';
import { cn } from "@/lib/utils"

function NavItem({ node, activeFilePath, onFileClick }: any) {
    const active = node.path === activeFilePath
    if (node.type === 'file') {
        return (
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => onFileClick(node.path)} className={cn(
                    "h-9 transition-all hover:bg-white",
                    active && "bg-white"
                )}>
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate text-xs font-medium text-slate-600">{node.name}</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        )
    }
    return (
        <SidebarMenuItem>
            <Collapsible className="group/collapsible">
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="h-9 hover:bg-white">
                        <Folder className="h-3.5 w-3.5 text-blue-400/70" />
                        <span className="truncate text-xs font-bold text-slate-700">{node.name}</span>
                        <ChevronRight className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenu className="ml-4 border-l border-slate-100 pl-2">
                        {node.children?.map((child: any) => <NavItem activeFilePath={activeFilePath} node={child} onFileClick={onFileClick} />)}
                    </SidebarMenu>
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuItem>
    )
}

export default function LayoutSide({ workspace, children }: any) {
    const [activeFilePath, setActiveFilePath] = useState<string | null>('')
    const [fileType, setFileType] = useState<string>('')

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

    const onFileClick = (path: string) => {
        setActiveFilePath(path)
    }

    useEffect(() => {
        if (workspace.files.length > 0 && !activeFilePath) {
            const _activeFilePath = workspace.files.find(node => node.type === 'file')
            const ext = _activeFilePath.path.split('.').pop()
            setFileType(ext)
            setActiveFilePath(_activeFilePath.path)
        }
    }, [workspace])

    return (
        //@ts-ignore
        <WorkspaceContext.Provider value={{ workspace, activeFilePath, editor, fileType }}>
            <Sidebar variant="floating" className="border-r-0 shadow-xl shadow-slate-200/50">
                <SidebarHeader className="p-4 flex flex-row items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center p-1.5">
                        <img src={Logo} />
                    </div>
                    <div className="flex flex-col overflow-hidden text-left leading-tight">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspace</span>
                        <span className="truncate text-sm font-bold text-slate-800">{workspace.name}</span>
                    </div>
                </SidebarHeader>
                <SidebarContent className="px-2 mt-4">
                    <SidebarMenu>
                        {workspace.files.map((node: any) => <NavItem activeFilePath={activeFilePath} node={node} onFileClick={onFileClick} />)}
                    </SidebarMenu>
                </SidebarContent>
            </Sidebar>
            {children}
        </WorkspaceContext.Provider>
    )
}