import type { LayoutProps } from "@/layout/types/index"
import React from "react"
import LayoutAside from "@/layout/layout-aside/index"
import LayoutMain from "@/layout/layout-main/index"
import { SidebarProvider } from "@/components/ui/sidebar"

export default function Layout({ workspace }: LayoutProps): React.JSX.Element {
  return (
    <>
      <SidebarProvider>
        <LayoutAside workspace={workspace}>
          <LayoutMain></LayoutMain>
        </LayoutAside>
      </SidebarProvider>
    </>
  )
}
