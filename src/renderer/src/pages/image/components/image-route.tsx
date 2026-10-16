import ActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { ImageContent } from "@/pages/image/components/image-content"
import { useNavigate } from "react-router-dom"

/** Renders the image route component. */
export function ImageRoute() {
  const navigate = useNavigate()
  return (
    <Layout
      aside={
        <ActivityBar
          activity="image"
          onActivityChange={(item) => navigate(item === "image" ? "/image" : item === "files" ? "/editor" : `/${item}`)}
        />
      }
    >
      <div className="h-full min-w-0 flex-1 overflow-hidden">
        <ImageContent />
      </div>
    </Layout>
  )
}
