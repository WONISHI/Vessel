import { ImageContent } from "@/components/ui/image/components/image-content"
import { ImageProps } from "@/components/ui/image/components/image-shared"

/** Renders the image component. */
export function Image(props: ImageProps) {
  return (
    <ImageContent
      key={props.sourceKey ?? props.src ?? "empty"}
      {...props}
    />
  )
}
