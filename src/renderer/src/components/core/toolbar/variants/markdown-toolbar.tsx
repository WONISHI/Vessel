import React, { useRef, useState } from "react";
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
    Strikethrough, Underline, Heading,
    Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
    Braces, Baseline, PaintBucket, PaintRoller, Check,
    List, ListOrdered, Indent, Outdent, CheckSquare,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    TextQuote, Table as TableIcon,
    Save, Image as ImageIcon, 
    type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- 类型定义 ---
interface MarkdownToolbarItem {
    label?: string;
    icon?: LucideIcon;
    action?: () => void;
    isActive?: () => boolean;
    groups?: MarkdownToolbarItem[];
    type?: 'separator' | 'color-picker';
    colorType?: 'text' | 'highlight';
}

// --- 预设颜色 ---
const PRESET_COLORS = [
    { label: 'Default', color: 'inherit', border: true },
    { label: 'Black', color: '#000000' },
    { label: 'Gray', color: '#64748b' },
    { label: 'Red', color: '#ef4444' },
    { label: 'Orange', color: '#f97316' },
    { label: 'Yellow', color: '#eab308' },
    { label: 'Green', color: '#22c55e' },
    { label: 'Blue', color: '#3b82f6' },
    { label: 'Purple', color: '#a855f7' },
    { label: 'Pink', color: '#ec4899' },
];


export default function MarkdownToolbar({ editor, onSave }: ToolbarProps): React.JSX.Element {
    if (!editor) return (<></>);

    const [copiedStyle, setCopiedStyle] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFormatBrush = () => {
        if (copiedStyle) {
            // 应用样式
            if (copiedStyle.bold) editor.chain().focus().setBold().run(); else editor.chain().focus().unsetBold().run();
            if (copiedStyle.italic) editor.chain().focus().setItalic().run(); else editor.chain().focus().unsetItalic().run();
            if (copiedStyle.strike) editor.chain().focus().setStrike().run(); else editor.chain().focus().unsetStrike().run();
            if (copiedStyle.underline) editor.chain().focus().setUnderline().run(); else editor.chain().focus().unsetUnderline().run();

            if (copiedStyle.color) editor.chain().focus().setColor(copiedStyle.color).run();
            else editor.chain().focus().unsetColor().run();

            if (copiedStyle.highlight) editor.chain().focus().toggleHighlight({ color: copiedStyle.highlight }).run();
            else editor.chain().focus().unsetHighlight().run();

            setCopiedStyle(null);
        } else {
            // 复制样式
            const styles = {
                bold: editor.isActive('bold'),
                italic: editor.isActive('italic'),
                strike: editor.isActive('strike'),
                underline: editor.isActive('underline'),
                color: editor.getAttributes('textStyle').color,
                highlight: editor.getAttributes('highlight').color,
            };
            setCopiedStyle(styles);
        }
    };

    // ✅ 3. 处理文件选择
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);

        // 简单处理：如果是图片则插入图片，视频则尝试插入视频标签
        if (file.type.startsWith('image/')) {
            editor.chain().focus().setImage({ src: url }).run();
        } else if (file.type.startsWith('video/')) {
            // 注意：TipTap 默认没有 video 扩展，这里使用 insertContent 插入 HTML
            editor.chain().focus().insertContent(`<video src="${url}" controls class="max-w-full h-auto rounded-md" />`).run();
        }

        // 重置 input 防止重复选择同一文件不触发 onChange
        e.target.value = '';
    };

    // 触发文件选择框
    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    // --- 工具栏配置 ---
    const items: MarkdownToolbarItem[] = [
        // 1. 历史记录
        { label: "Undo", icon: Undo2, action: () => editor.chain().focus().undo().run(), isActive: () => false },
        { label: "Redo", icon: Redo2, action: () => editor.chain().focus().redo().run(), isActive: () => false },

        { type: "separator" },

        // 2. 格式刷
        {
            label: copiedStyle ? "Apply Format" : "Format Brush",
            icon: PaintRoller,
            action: handleFormatBrush,
            isActive: () => !!copiedStyle
        },

        { type: "separator" },
        {
            label: "Heading",
            icon: Heading,
            isActive: () => editor.isActive('heading'),
            groups: [
                { label: "Heading 1", icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive('heading', { level: 1 }) },
                { label: "Heading 2", icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive('heading', { level: 2 }) },
                { label: "Heading 3", icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive('heading', { level: 3 }) },
                { label: "Heading 4", icon: Heading4, action: () => editor.chain().focus().toggleHeading({ level: 4 }).run(), isActive: () => editor.isActive('heading', { level: 4 }) },
                { label: "Heading 5", icon: Heading5, action: () => editor.chain().focus().toggleHeading({ level: 5 }).run(), isActive: () => editor.isActive('heading', { level: 5 }) },
                { label: "Heading 6", icon: Heading6, action: () => editor.chain().focus().toggleHeading({ level: 6 }).run(), isActive: () => editor.isActive('heading', { level: 6 }) },
            ]
        },

        { type: "separator" },

        // 4. 颜色与高亮
        { type: "color-picker", colorType: "text", label: "Text Color", icon: Baseline },
        { type: "color-picker", colorType: "highlight", label: "Highlight", icon: PaintBucket },

        { type: "separator" },

        // 5. 基础格式
        { label: "Bold", icon: Bold, action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold') },
        { label: "Italic", icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic') },
        { label: "Underline", icon: Underline, action: () => editor.chain().focus().toggleUnderline().run(), isActive: () => editor.isActive('underline') },
        { label: "Strikethrough", icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike') },
        { label: "Code Block", icon: Braces, action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive('codeBlock') },

        { type: "separator" },

        // 6. 列表
        {
            label: "Lists",
            icon: List,
            isActive: () => editor.isActive('bulletList') || editor.isActive('orderedList'),
            groups: [
                { label: "Bullet List", icon: List, action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
                { label: "Ordered List", icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
                { label: "Indent", icon: Indent, action: () => editor.chain().focus().sinkListItem('listItem').run(), isActive: () => false },
                { label: "Outdent", icon: Outdent, action: () => editor.chain().focus().liftListItem('listItem').run(), isActive: () => false }
            ]
        },
        { label: "Checklist", icon: CheckSquare, action: () => editor.chain().focus().toggleTaskList().run(), isActive: () => editor.isActive('taskList') },
        {
            label: "Alignment",
            icon: AlignLeft,
            isActive: () => editor.isActive({ textAlign: 'left' }) || editor.isActive({ textAlign: 'center' }) || editor.isActive({ textAlign: 'right' }),
            groups: [
                { label: "Align Left", icon: AlignLeft, action: () => editor.chain().focus().setTextAlign('left').run(), isActive: () => editor.isActive({ textAlign: 'left' }) },
                { label: "Align Center", icon: AlignCenter, action: () => editor.chain().focus().setTextAlign('center').run(), isActive: () => editor.isActive({ textAlign: 'center' }) },
                { label: "Align Right", icon: AlignRight, action: () => editor.chain().focus().setTextAlign('right').run(), isActive: () => editor.isActive({ textAlign: 'right' }) },
                { label: "Justify", icon: AlignJustify, action: () => editor.chain().focus().setTextAlign('justify').run(), isActive: () => editor.isActive({ textAlign: 'justify' }) }
            ]
        },
        { type: "separator" },
        { label: "Block Quote", icon: TextQuote, action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive('blockquote') },
        { label: "Insert Table", icon: TableIcon, action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), isActive: () => editor.isActive('table') },
        { label: "Insert Media (Image/Video)", icon: ImageIcon, action: triggerFileUpload, isActive: () => false },
        { type: "separator" },
        { label: "Clear Format", icon: Eraser, action: () => editor.chain().focus().unsetAllMarks().clearNodes().run(), isActive: () => false },
        { type: "separator" },
        { label: "Save File", icon: Save, action: onSave || (() => { }), isActive: () => false },
    ];

    return (
        <div className="py-2 bg-white flex justify-center w-full sticky top-0 z-20">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*"
                onChange={handleFileSelect}
            />

            <div className="rounded-full border shadow-sm bg-white px-4 py-1.5 flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar">
                <TooltipProvider delayDuration={0}>
                    {items.map((item, index) => {
                        if (item.type === "separator") {
                            return <div key={index} className="w-px h-5 bg-slate-200 mx-1 shrink-0" />;
                        }

                        if (item.type === "color-picker") {
                            return <ColorPicker key={index} item={item} editor={editor} />;
                        }

                        if (item.groups && item.groups.length > 0) {
                            return <GroupDropdown key={index} item={item} />;
                        }

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

// --- 子组件：颜色选择器 ---
function ColorPicker({ item, editor }: { item: MarkdownToolbarItem, editor: any }) {
    const Icon = item.icon!;
    const isText = item.colorType === 'text';

    // 安全获取颜色，防止 getAttributes 返回 undefined
    const textStyle = editor.getAttributes('textStyle');
    const highlight = editor.getAttributes('highlight');
    const currentColor = isText ? textStyle?.color : highlight?.color;

    const handleColorChange = (color: string) => {
        if (color === 'inherit') {
            if (isText) editor.chain().focus().unsetColor().run();
            else editor.chain().focus().unsetHighlight().run();
        } else {
            if (isText) editor.chain().focus().setColor(color).run();
            else editor.chain().focus().toggleHighlight({ color }).run();
        }
    };

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-slate-600 hover:bg-slate-100 relative">
                            <Icon className="h-4 w-4" />
                            <div
                                className="absolute bottom-1.5 left-2 right-2 h-[3px] rounded-full"
                                style={{ backgroundColor: currentColor || (isText ? '#000' : 'transparent') }}
                            />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{item.label}</p></TooltipContent>
            </Tooltip>

            <DropdownMenuContent align="center" className="p-2 w-[164px]">
                <div className="grid grid-cols-5 gap-1.5">
                    {PRESET_COLORS.map((c) => (
                        <button
                            key={c.color}
                            onClick={() => handleColorChange(c.color)}
                            className={cn(
                                "w-6 h-6 rounded-full border flex items-center justify-center transition-transform hover:scale-110 focus:outline-none",
                                c.border ? "border-slate-200" : "border-transparent"
                            )}
                            style={{ backgroundColor: c.color === 'inherit' ? 'transparent' : c.color }}
                            title={c.label}
                        >
                            {c.color === 'inherit' && <div className="w-full h-px bg-red-500 rotate-45" />}
                            {currentColor === c.color && c.color !== 'inherit' && (
                                <Check className="w-3 h-3 text-white drop-shadow-md" />
                            )}
                        </button>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// --- 子组件：普通按钮 ---
function SingleToolbarButton({ item }: { item: MarkdownToolbarItem }) {
    const Icon = item.icon!;
    const active = item.isActive ? item.isActive() : false;
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={item.action}
                    className={cn(
                        "h-8 w-8 shrink-0",
                        active
                            ? "bg-slate-900 text-white hover:bg-slate-700 hover:text-white"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                >
                    <Icon className="h-4 w-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>{item.label}</p></TooltipContent>
        </Tooltip>
    );
}

// --- 子组件：下拉菜单 ---
function GroupDropdown({ item }: { item: MarkdownToolbarItem }) {
    const MainIcon = item.icon!;
    const isGroupActive = item.isActive ? item.isActive() : false;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-8 px-2 gap-1 shrink-0 data-[state=open]:bg-slate-100",
                        isGroupActive
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-600 hover:bg-slate-100"
                    )}
                >
                    <MainIcon className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="center" className="min-w-[140px]">
                {item.groups?.map((subItem, subIndex) => {
                    const SubIcon = subItem.icon!;
                    const isSubActive = subItem.isActive ? subItem.isActive() : false;

                    return (
                        <DropdownMenuItem
                            key={subIndex}
                            onClick={subItem.action}
                            className={cn(
                                "gap-2 cursor-pointer",
                                isSubActive && "bg-slate-50 font-medium"
                            )}
                        >
                            <SubIcon className="h-4 w-4 text-slate-500" />
                            <span className="flex-1">{subItem.label}</span>
                            {isSubActive && <Check className="h-3 w-3 text-slate-900" />}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}