import React from "react";
import { ToolbarProps } from "@/components/core/toolbar/types";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Bold, Italic, Undo2, Redo2, Eraser, ChevronDown,
    Strikethrough, Highlighter, Underline, Heading,
    Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
    Braces,
    type LucideIcon
} from "lucide-react";

interface MarkdownToolbarItem {
    label?: string;
    icon?: LucideIcon;
    action?: () => void;
    isActive?: () => boolean;
    groups?: MarkdownToolbarItem[];
    type?: 'separator'; // 增加类型标识，用于分割线
}

export default function MarkdownToolbar({ editor }: ToolbarProps): React.JSX.Element {
    if (!editor) return (<></>);

    const items: MarkdownToolbarItem[] = [
        { label: "Undo", icon: Undo2, action: () => editor.chain().focus().undo().run() },
        { label: "Redo", icon: Redo2, action: () => editor.chain().focus().redo().run() },
        { type: "separator" },
        { label: "Clear Format", icon: Eraser, action: () => editor.chain().focus().unsetAllMarks().run() },
        { type: "separator" }, 
        {
            label: "Heading",
            icon: Heading,
            groups: [
                { label: "Heading 1", icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
                { label: "Heading 2", icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
                { label: "Heading 3", icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
                { label: "Heading 4", icon: Heading4, action: () => editor.chain().focus().toggleHeading({ level: 4 }).run() },
                { label: "Heading 5", icon: Heading5, action: () => editor.chain().focus().toggleHeading({ level: 5 }).run() },
                { label: "Heading 6", icon: Heading6, action: () => editor.chain().focus().toggleHeading({ level: 6 }).run() },
            ]
        },
        { label: "Bold", icon: Bold, action: () => editor.chain().focus().toggleBold().run() },
        { label: "Italic", icon: Italic, action: () => editor.chain().focus().toggleItalic().run() },
        { label: "Strikethrough", icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run() },
        { label: "Underline", icon: Underline, action: () => editor.chain().focus().toggleUnderline().run() },
        { label: "Highlight", icon: Highlighter, action: () => editor.chain().focus().toggleHighlight().run() },
        { label: "Code Block", icon: Braces, action: () => editor.chain().focus().toggleCodeBlock().run() },
    ];

    return (
        <div className="py-4 flex justify-center w-full">
            <div className="rounded-full border shadow-sm bg-white px-4 py-2 flex items-center gap-1">
                <TooltipProvider delayDuration={0}>
                    {items.map((item, index) => {
                        // 1. 处理分割线
                        if (item.type === "separator") {
                            return <div key={index} className="w-px h-5 bg-slate-200 mx-1" />;
                        }

                        // 2. 处理下拉菜单分组
                        if (item.groups && item.groups.length > 0) {
                            return <GroupDropdown key={index} item={item} />;
                        }

                        // 3. 处理普通按钮
                        // 必须确保 item.icon 存在才能渲染 SingleToolbarButton
                        if (item.icon && item.action) {
                            return <SingleToolbarButton key={index} item={item} />;
                        }

                        return null;
                    })}
                </TooltipProvider>
            </div>
        </div>
    );
}

// --- 子组件 1: 普通按钮 ---
function SingleToolbarButton({ item }: { item: MarkdownToolbarItem }): React.JSX.Element {
    const Icon = item.icon!; // 断言 icon 一定存在
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={item.action}
                    className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                    <Icon className="h-4 w-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
                <p>{item.label}</p>
            </TooltipContent>
        </Tooltip>
    );
}

// --- 子组件 2: 下拉菜单 ---
function GroupDropdown({ item }: { item: MarkdownToolbarItem }): React.JSX.Element {
    const MainIcon = item.icon!; // 断言 icon 一定存在

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1 text-slate-600 hover:bg-slate-100 data-[state=open]:bg-slate-100"
                >
                    <MainIcon className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="center" className="min-w-[120px]">
                {item.groups?.map((subItem, subIndex) => {
                    const SubIcon = subItem.icon!;
                    return (
                        <DropdownMenuItem 
                            key={subIndex} 
                            onClick={subItem.action}
                            className="gap-2 cursor-pointer"
                        >
                            <SubIcon className="h-4 w-4 text-slate-500" />
                            <span>{subItem.label}</span>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}