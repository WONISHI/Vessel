import BreadCrumb from "@/layout/layout-main/breadcrumb"
import Canvas from "@/layout/layout-main/canvas"

export default function LayoutMain() {
  return (
    <main className="w-full overflow-hidden relative flex flex-1 flex-col bg-[#fafafa]">
      {/* 面包屑导航 */}
      <BreadCrumb></BreadCrumb>
      {/* 编辑区 */}
      <Canvas></Canvas>
    </main>
  )
}
