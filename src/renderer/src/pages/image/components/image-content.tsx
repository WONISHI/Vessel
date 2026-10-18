import { useToolboxImageImport } from "@/components/image-toolbox/import-state"
import { ImageToolbox } from "@/components/image-toolbox/index"
import { useSidebar } from "@/components/ui/sidebar"

/** Renders the image content component. */
export function ImageContent() {
  const imported = useToolboxImageImport()
  const { open, openMobile, isMobile, setOpen, setOpenMobile } = useSidebar()
  return (
    <ImageToolbox
      key={imported?.id ?? "default"}
      initialImage={imported?.source}
      initialTool={imported ? "resize" : "ocr"}
      navigationOpen={isMobile ? openMobile : open}
      onNavigationChange={isMobile ? setOpenMobile : setOpen}
    />
  )
}
