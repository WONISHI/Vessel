import { Button } from "@/components/ui/button"
import { useCarousel } from "@/components/ui/carousel/components/carousel-shared"
import { cn } from "@/lib/utils"
import { ChevronLeft } from "lucide-react"
import * as React from "react"

/** Renders the carousel previous component. */
export const CarouselPrevious = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn("absolute size-8 rounded-full shadow-sm z-10", orientation === "horizontal" ? "left-2 top-1/2 -translate-y-1/2" : "top-2 left-1/2 -translate-x-1/2 rotate-90", className)}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ChevronLeft className="size-4" />
      <span className="sr-only">Previous slide</span>
    </Button>
  )
})

CarouselPrevious.displayName = "CarouselPrevious"
