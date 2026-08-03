import BreadCrumb from "@/layout/layout-main/breadcrumb"
import Canvas from "@/layout/layout-main/canvas"

export default function LayoutMain() {
  return (
    <main className="w-full overflow-hidden relative flex flex-1 flex-col bg-white">
      <BreadCrumb />
      <Canvas />
    </main>
  )
}
