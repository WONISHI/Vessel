import Layout from "@/layout"
import ActivityBar from "@/layout/activity-bar"
import { useNavigate } from "react-router-dom"
import { ImageToolbox } from "@/pages/image-preview/image-toolbox"

export default function ImageRoute() {
  const navigate = useNavigate()
  return (
    <Layout
      aside={
        <ActivityBar
          activity="image"
          onActivityChange={(item) =>
            navigate(item === "image" ? "/image" : item === "files" ? "/editor" : `/${item}`)
          }
        />
      }
    >
      <div className="h-full min-w-0 flex-1 overflow-hidden">
        <ImageToolbox />
      </div>
    </Layout>
  )
}
