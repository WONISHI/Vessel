import type { ReactNode } from "react"

export interface LayoutProps {
  /** 页面提供的侧栏区域，不包含业务状态。 */
  aside: ReactNode
  /** 页面提供的主内容区域，例如标签栏和路由出口。 */
  children: ReactNode
}

/** 提供全屏左右布局及溢出边界；具体页面负责导航、数据和交互。 */
export default function Layout({ aside, children }: LayoutProps) {
  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-[#faf9f7] text-stone-800">
      {aside}
      {children}
    </div>
  )
}
