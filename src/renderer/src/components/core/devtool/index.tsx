import React, { useState, useEffect, useRef } from "react";
import { 
    Cog, RefreshCcw, Bug, FolderSymlink, Terminal, 
    Ban, X, type LucideIcon, Play, Square, Trash2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet";
import { TreeView } from "@/components/ui/tree"
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// --- 类型定义 ---
interface DevToolsItem {
    label: string;
    icon: LucideIcon;
    action?: () => void;
    children?: React.ReactNode;
    active?: boolean;
}

interface LogEntry {
    type: 'log' | 'warn' | 'error' | 'info';
    message: any[];
    timestamp: string;
}

export default function DevTool() {
    const navigate = useNavigate();
    
    // --- 控制台状态管理 ---
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    
    // 从 localStorage 初始化状态
    const [isSpyEnabled, setIsSpyEnabled] = useState(() => {
        const saved = localStorage.getItem('vessel-dev-spy');
        return saved === 'true';
    });
    
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);

    // --- 拖拽状态管理 ---
    const [position, setPosition] = useState<{ x: number, y: number } | null>(null);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const timerRef = useRef<any>(null);

    // --- 监听 toggle 变化并保存到 localStorage ---
    const toggleSpy = () => {
        const newState = !isSpyEnabled;
        setIsSpyEnabled(newState);
        localStorage.setItem('vessel-dev-spy', String(newState));
        
        if (!newState) {
            toast.dismiss(); // 关闭所有未关闭的 toast
        }
    };

    // --- 核心：可切换的 Console 拦截逻辑 ---
    useEffect(() => {
        if (!isSpyEnabled) return;

        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        const originalInfo = console.info;

        // 格式化参数，支持对象展开显示
        const formatArgs = (args: any[]) => {
            return args.map(arg => {
                if (typeof arg === 'object') {
                    try { 
                        // 缩进 2 格，保持格式
                        return JSON.stringify(arg, null, 2); 
                    } catch (e) { return '[Circular Object]'; }
                }
                return String(arg);
            }).join(' ');
        };

        const handleLog = (type: LogEntry['type'], args: any[]) => {
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            
            // 1. 存入历史记录
            setLogs(prev => [...prev, { type, message: args, timestamp }]);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

            // 2. 弹窗展示 (使用 sonner 的自定义 JSX 功能)
            const msg = formatArgs(args);
            
            // 定义通用样式
            const toastOptions = {
                duration: Infinity, // 🔴 关键：设置为无限，不会自动关闭
                onDismiss: () => {}, // 可选：关闭时的回调
                cancel: {
                    label: '关闭',
                    onClick: () => {}
                }
            };

            // 使用自定义组件渲染内容，确保能完整显示
            const Content = () => (
                <div className="max-h-[200px] overflow-y-auto w-full text-xs font-mono break-all whitespace-pre-wrap">
                   {msg}
                </div>
            );

            if (type === 'error') {
                toast.error(<Content />, { ...toastOptions, description: 'Console Error' });
            } else if (type === 'warn') {
                toast.warning(<Content />, { ...toastOptions, description: 'Console Warning' });
            } else {
                toast.info(<Content />, { ...toastOptions, description: 'Console Log' });
            }
        };

        console.log = (...args) => { originalLog(...args); handleLog('log', args); };
        console.warn = (...args) => { originalWarn(...args); handleLog('warn', args); };
        console.error = (...args) => { originalError(...args); handleLog('error', args); };
        console.info = (...args) => { originalInfo(...args); handleLog('info', args); };

        toast.success("Console 监听已开启 (所有日志将保留直到手动关闭)", { duration: 3000 });

        return () => {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;
            console.info = originalInfo;
        };
    }, [isSpyEnabled]);

    // --- 拖拽处理逻辑 ---
    const handleMouseDownCapture = (e: React.MouseEvent) => {
        if (e.button !== 2) return;
        const el = e.currentTarget as HTMLElement;
        const rect = el.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        isDraggingRef.current = false;
        timerRef.current = setTimeout(() => {
            isDraggingRef.current = true;
            toast.info("进入拖拽模式", { duration: 1000 });
        }, 300);

        const handleMouseMove = (ev: MouseEvent) => {
            ev.preventDefault();
            if (isDraggingRef.current) {
                const newX = Math.min(Math.max(0, ev.clientX - offsetX), window.innerWidth - rect.width);
                const newY = Math.min(Math.max(0, ev.clientY - offsetY), window.innerHeight - rect.height);
                setPosition({ x: newX, y: newY });
            } else {
                const moveDist = Math.hypot(ev.clientX - dragStartRef.current.x, ev.clientY - dragStartRef.current.y);
                if (moveDist > 5 && timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
            }
        };

        const handleMouseUp = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            isDraggingRef.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // --- 菜单配置 ---
    const devTools: DevToolsItem[] = [
        {
            label: isSpyEnabled ? '关闭 Console 监听' : '开启 Console 监听',
            icon: isSpyEnabled ? Square : Play,
            active: isSpyEnabled,
            action: toggleSpy
        },
        // 🔴 新增：一键清除所有弹窗
        {
            label: '清除所有弹窗',
            icon: Trash2,
            action: () => toast.dismiss()
        },
        {
            label: '打开历史记录面板',
            icon: Terminal,
            action: () => setIsConsoleOpen(true)
        },
        { type: 'separator' } as any,
        {
            label: '测试 Log',
            icon: Bug,
            action: () => {
                console.log('这是一条很长的测试日志对象', { 
                    user: { name: 'Vessel', id: 1 },
                    settings: { theme: 'dark', notifications: true },
                    array: [1, 2, 3, 4, 5]
                });
                console.error('测试错误信息');
            }
        }, 
        {
            label: '刷新页面',
            icon: RefreshCcw,
            action: () => window.location.reload()
        },
        {
            label: '页面跳转',
            icon: FolderSymlink,
            children: (
                <div className="p-1 min-w-[120px]">
                    <TreeView
                        data={[
                            { name: '首页', path: '/' },
                            { name: '编辑器', path: '/editor' }
                        ]}
                        onSelect={(path) => navigate(path)}
                    />
                </div>
            )
        }
    ];

    return (
        <>
            <div 
                className={cn(
                    "fixed z-50 transition-shadow",
                    !position && "right-4 bottom-4", 
                )}
                style={position ? { left: position.x, top: position.y } : undefined}
                onContextMenu={(e) => e.preventDefault()}
                onMouseDownCapture={handleMouseDownCapture}
            >
                <DropdownMenu>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className={cn(
                                            "h-10 w-10 rounded-full shadow-lg bg-white border-slate-200 hover:bg-slate-50 text-slate-600 cursor-move",
                                            isSpyEnabled && "ring-2 ring-green-500 border-green-500 text-green-600"
                                        )}
                                    >
                                        <Cog className={cn(
                                            "h-5 w-5 transition-transform duration-500",
                                            isSpyEnabled && "animate-spin-slow"
                                        )} />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                <p>Developer Tools (Right-click Hold to Drag)</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <DropdownMenuContent align="end" className="w-64 mb-2">
                        <DropdownMenuLabel>Dev Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        
                        {devTools.map((item, index) => {
                            if ((item as any).type === 'separator') {
                                return <DropdownMenuSeparator key={index} />;
                            }
                            const Icon = item.icon;
                            if (item.children) {
                                return (
                                    <DropdownMenuSub key={index}>
                                        <DropdownMenuSubTrigger className="cursor-pointer gap-2">
                                            <Icon className="h-4 w-4 text-slate-500" />
                                            <span>{item.label}</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="p-0">
                                            {item.children}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                )
                            }
                            return (
                                <DropdownMenuItem
                                    key={index}
                                    onClick={item.action}
                                    className={cn(
                                        "cursor-pointer gap-2",
                                        item.active && "bg-green-50 text-green-700 focus:bg-green-100 focus:text-green-800"
                                    )}
                                >
                                    <Icon className={cn("h-4 w-4", item.active ? "text-green-600" : "text-slate-500")} />
                                    <span>{item.label}</span>
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Sheet open={isConsoleOpen} onOpenChange={setIsConsoleOpen}>
                <SheetContent side="bottom" className="h-[40vh] p-0 flex flex-col shadow-2xl border-t border-slate-200 z-[100]">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-semibold text-slate-700">Console History</span>
                            <span className="text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {logs.length} events
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 text-xs hover:bg-slate-200 text-slate-500"
                                onClick={() => setLogs([])}
                            >
                                <Ban className="h-3 w-3 mr-1" />
                                Clear
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 hover:bg-slate-200"
                                onClick={() => setIsConsoleOpen(false)}
                            >
                                <X className="h-4 w-4 text-slate-500" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-slate-50 space-y-1">
                        {logs.length === 0 && (
                            <div className="text-slate-400 italic text-center py-4">
                                No logs recorded in this session...
                            </div>
                        )}
                        {logs.map((log, i) => (
                            <div key={i} className={cn(
                                "flex items-start gap-2 py-1 px-2 rounded hover:bg-slate-200/50 break-all",
                                log.type === 'error' && "text-red-600 bg-red-50 hover:bg-red-100",
                                log.type === 'warn' && "text-amber-600 bg-amber-50 hover:bg-amber-100",
                                log.type === 'info' && "text-blue-600",
                            )}>
                                <span className="text-slate-400 shrink-0 select-none">[{log.timestamp}]</span>
                                <div className="flex-1 flex gap-2">
                                    {log.message.map((msg, j) => (
                                        <span key={j} className="whitespace-pre-wrap">
                                            {typeof msg === 'object' ? JSON.stringify(msg, null, 2) : String(msg)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}