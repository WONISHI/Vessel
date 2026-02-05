import BreadCrumb from "@/layout/layout-main/breadcrumb"
import ToolBar from "@/layout/layout-main/toolbar"

export default function LayoutMain() {
    return (
        <main className="relative flex flex-1 flex-col bg-[#fafafa]">
            {/* 面包屑导航 */}
            <BreadCrumb></BreadCrumb>
            {/* 工具栏 */}
            <ToolBar></ToolBar>
        </main>
    )
}