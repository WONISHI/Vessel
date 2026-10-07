import "./tools.css"
import Layout from "@/layout"
import ActivityBar from "@/layout/activity-bar"
import { Code, Palette, Binary, Link } from 'lucide-react'
import { RouterView } from '@vessel/react-router/components'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable-panels'
import { useSidebar } from "@/components/ui/sidebar"
const groups = [
  { title: '图像', items: [{ id: 'json', title: 'JSON 格式化', icon: Code }, { id: 'color', title: '颜色转换', icon: Palette }] },
  { title: '编码', items: [{ id: 'base64', title: 'Base64', icon: Binary }, { id: 'url', title: 'URL 编解码', icon: Link }] }
]
export default function DevToolsIndex() {
  const navigate = useNavigate()
  return <Layout aside={<ActivityBar activity="tools" onActivityChange={item => navigate(item === "tools" ? "/devtools" : item === "files" ? "/editor" : `/${item}`)} />}><DevToolsBody /></Layout>
}
function DevToolsBody() {
  const { pathname } = useLocation(), navigate = useNavigate()
  const { open, openMobile, isMobile } = useSidebar()
  const expanded = isMobile ? openMobile : open
  return <ResizablePanelGroup orientation="horizontal" className="dev-tools h-full bg-white">{expanded && <><ResizablePanel defaultSize="232px" minSize="232px" maxSize="320px"><aside className="flex h-full flex-col bg-[#FAFAF9]"><h1 className="dev-sidebar-title px-4 py-4 text-sm font-bold text-stone-800">开发工具</h1><ScrollArea className="min-h-0 flex-1 px-2">{groups.map(group => <section key={group.title} className="dev-nav-group mb-3"><h2 className="dev-nav-label px-2 py-2 text-[10px] font-bold tracking-wide text-stone-400">{group.title}</h2>{group.items.map(({id,title,icon:Icon}) => <Button key={id} variant="ghost" onClick={() => navigate(`/devtools/${id}`)} aria-current={pathname.endsWith('/'+id) ? 'page' : undefined} className="dev-nav-item mb-0.5 h-9 w-full justify-start gap-2 rounded-md px-2 text-xs font-normal text-stone-600 hover:bg-[#f0efed] aria-[current=page]:bg-white aria-[current=page]:font-semibold aria-[current=page]:text-green-700 aria-[current=page]:shadow-sm"><Icon className="size-4" />{title}</Button>)}</section>)}</ScrollArea></aside></ResizablePanel><ResizableHandle aria-label="调整开发工具侧栏宽度" /></>}<ResizablePanel minSize="350px"><main className="h-full min-w-0 overflow-hidden"><RouterView /></main></ResizablePanel></ResizablePanelGroup>
}
