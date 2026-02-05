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
    const { workspace, activeFilePath } = useWorkspace();
    const [segments, setSegments] = useState<string[]>([]);

    useEffect(() => {
        if (!workspace || !Object.keys(workspace).length || !activeFilePath) {
            setSegments([]);
            return;
        }

        try {
            // 简单的路径切割逻辑
            // 1. 以 workspace.name 为界切割，取后半部分
            // 注意：这只是一个简单的假设，实际建议后端返回相对路径，或者用 path.relative 计算
            const parts = activeFilePath.split(workspace.name);
            
            if (parts.length > 1) {
                // 取最后一个部分（防止路径前面也有和 workspace.name 重名的文件夹）
                const relativePath = parts.pop(); 
                // 2. 分割并过滤掉空字符串 (比如开头是 / 产生的空串)
                const _segments = relativePath?.split('/').filter(Boolean) || [];
                setSegments(_segments);
            } else {
                // 降级处理：直接显示文件名
                setSegments([activeFilePath]);
            }
        } catch (e) {
            console.error("Breadcrumb parsing error", e);
        }
    }, [workspace, activeFilePath]);

    return (
        <header className="sticky top-0 z-10 flex h-14 items-center border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl justify-between">
            <div className="flex items-center gap-2">
                {/* 侧边栏开关 */}
                <SidebarTrigger className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900" />
                
                {/* 竖线分隔 */}
                <Separator orientation="vertical" className="mr-2 h-4 bg-slate-300" />

                {/* 面包屑主体 */}
                <Breadcrumb>
                    <BreadcrumbList className="text-[12px] sm:text-[13px]">
                        
                        {/* 根节点：工作区名称 */}
                        <BreadcrumbItem>
                            <BreadcrumbLink 
                                href="#" 
                                className="font-semibold text-slate-700 hover:text-slate-900"
                            >
                                {workspace?.name || 'Workspace'}
                            </BreadcrumbLink>
                        </BreadcrumbItem>

                        {segments.length > 0 && <BreadcrumbSeparator />}

                        {/* 动态路径片段 */}
                        {segments.map((segment, index) => {
                            const isLast = index === segments.length - 1;

                            return (
                                <Fragment key={`${segment}-${index}`}>
                                    <BreadcrumbItem>
                                        {isLast ? (
                                            // 最后一项：当前页面（不可点击，颜色较深）
                                            <BreadcrumbPage className="font-medium text-slate-900">
                                                {segment}
                                            </BreadcrumbPage>
                                        ) : (
                                            // 中间项：链接（可点击，颜色较浅）
                                            <BreadcrumbLink 
                                                href="#" 
                                                className="text-slate-500 hover:text-slate-700 transition-colors"
                                            >
                                                {segment}
                                            </BreadcrumbLink>
                                        )}
                                    </BreadcrumbItem>
                                    {/* 只有不是最后一项时才显示分隔符 */}
                                    {!isLast && <BreadcrumbSeparator />}
                                </Fragment>
                            );
                        })}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
            
            {/* 右侧区域（预留给 Save 按钮或其他工具） */}
            <div className="flex items-center gap-2">
                {/* <span className="text-xs text-slate-400">Read Only</span> */}
            </div>
        </header>
    )
}