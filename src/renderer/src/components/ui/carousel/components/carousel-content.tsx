import { useCarousel } from "@/components/ui/carousel/components/carousel-shared"
import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the carousel content component. */
export const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const { carouselRef, orientation } = useCarousel()

  return (
    <div
      ref={carouselRef}
      className="overflow-hidden"
    >
      <div
        ref={ref}
        className={cn("flex", orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col", className)}
        {...props}
      />
    </div>
  )
})

CarouselContent.displayName = "CarouselContent"
