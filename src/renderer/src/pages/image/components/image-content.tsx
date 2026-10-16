import { ImageToolbox } from "@/components/image-toolbox/index"
import { useSidebar } from "@/components/ui/sidebar"

/** Renders the image content component. */
export function ImageContent() {
  const { open, openMobile, isMobile, setOpen, setOpenMobile } = useSidebar()
  return (
    <ImageToolbox
      navigationOpen={isMobile ? openMobile : open}
      onNavigationChange={isMobile ? setOpenMobile : setOpen}
    />
  )
}
