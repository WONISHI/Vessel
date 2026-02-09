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