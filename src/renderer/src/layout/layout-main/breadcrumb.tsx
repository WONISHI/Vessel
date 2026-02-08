import { useWorkspace } from '@/layout/context/WorkspaceContext';
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
    BreadcrumbPage
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { useEffect, useState, Fragment } from 'react';

export default function BreadCrumb() {
    // 假设 context 中有一个 setExpandedFolders 或 similar 方法用来控制侧边栏展开
    // 如果没有，你需要自己在 Context 中添加一个用来控制展开状态的方法
    const { workspace, activeFilePath, changeCollapsible } = useWorkspace();
    const [segments, setSegments] = useState<string[]>([]);

    // 修改 jumpRoute 接收完整路径
    const jumpRoute = (fullPath?: string) => {
        if (!fullPath) return;
        changeCollapsible(fullPath)
    }

    useEffect(() => {
        if (!workspace || !Object.keys(workspace).length || !activeFilePath) {
            setSegments([]);
            return;
        }

        try {
            // 这里逻辑保持不变，依然是切割出相对路径片段
            const parts = activeFilePath.split(workspace.name);
            if (parts.length > 1) {
                // 注意：这里假设 activeFilePath 是 /root/project/src/index.tsx
                // split 可能会导致首位出现空字符串，建议处理一下路径归一化
                // 这里的处理比较依赖你的 activeFilePath 格式，假设它是标准的
                const relativePath = activeFilePath.replace(workspace.path, '');
                const _segments = relativePath.split('/').filter(Boolean);
                setSegments(_segments);
            } else {
                setSegments([activeFilePath]); // Fallback
            }
        } catch (e) {
            console.error("Breadcrumb parsing error", e);
        }
    }, [workspace, activeFilePath]);

    return (
        <header className="sticky top-0 z-10 flex h-14 items-center border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl justify-between">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer" />
                <Separator orientation="vertical" className="mr-2 h-4 bg-slate-300" />

                <Breadcrumb>
                    <BreadcrumbList className="text-[12px] sm:text-[13px]">

                        {/* 根节点：点击打开根目录 */}
                        <BreadcrumbItem>
                            <BreadcrumbLink
                                className="font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                                onClick={() => jumpRoute(workspace?.path)}
                            >
                                {workspace?.name || 'Workspace'}
                            </BreadcrumbLink>
                        </BreadcrumbItem>

                        {segments.length > 0 && <BreadcrumbSeparator />}

                        {segments.map((segment, index) => {
                            const isLast = index === segments.length - 1;

                            // 【核心修改】：动态计算当前 segment 的完整路径
                            // 逻辑：工作区根路径 + 前面所有的片段 + 当前片段
                            // 举例：['src', 'components', 'Button.tsx']
                            // index 0 ('src') -> workspace.path + '/src'
                            // index 1 ('components') -> workspace.path + '/src/components'
                            const currentPath = `${workspace?.path}/${segments.slice(0, index + 1).join('/')}`;

                            return (
                                <Fragment key={`${segment}-${index}`}>
                                    <BreadcrumbItem>
                                        {isLast ? (
                                            <BreadcrumbPage className="font-medium text-slate-900">
                                                {segment}
                                            </BreadcrumbPage>
                                        ) : (
                                            <BreadcrumbLink
                                                className="text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                                                // 传入计算好的完整路径
                                                onClick={() => jumpRoute(currentPath)}
                                            >
                                                {segment}
                                            </BreadcrumbLink>
                                        )}
                                    </BreadcrumbItem>
                                    {!isLast && <BreadcrumbSeparator />}
                                </Fragment>
                            );
                        })}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
            <div className="flex items-center gap-2"></div>
        </header>
    )
}