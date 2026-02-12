import { useState } from "react"
import * as ImagePreviewModule from "react-dczs-image-preview"
import "react-dczs-image-preview/lib/style.css"

const ReactImagePreview = ImagePreviewModule.default || ImagePreviewModule.reactImagePreview

export default function MediaCanvas({ activeFilePath }: any) {
  const [showPreview, setShowPreview] = useState(false)

  // 主动触发预览（例如点击按钮或自动显示）
  // 这里演示组件加载后自动显示，实际场景可能由点击事件触发
  // useEffect(() => { setShowPreview(true); }, []);

  return (
    <>
      {/* 这里需要某种方式将 showPreview 设为 true，否则预览框一直隐藏 */}
      <button onClick={() => setShowPreview(true)}>预览图片</button>

      <ReactImagePreview
        showBox={showPreview}
        imgData={activeFilePath}
        close={() => setShowPreview(false)} // 点击关闭时隐藏
      />
    </>
  )
}
