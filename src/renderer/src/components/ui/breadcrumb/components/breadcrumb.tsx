import * as React from "react"

/** Renders the breadcrumb component. */
export const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode
  }
>(({ ...props }, ref) => (
  <nav
    ref={ref}
    aria-label="breadcrumb"
    {...props}
  />
))

Breadcrumb.displayName = "Breadcrumb"
