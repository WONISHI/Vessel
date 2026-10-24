import * as React from "react"
import { ToastErrorDetails } from "@/components/ui/toast-error-details"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Keep expandable error details without adding automatic notification actions.
const toast = Object.assign((message: any, data?: any) => sonnerToast(message, data), sonnerToast, {
  /** Performs the error operation. */
  error: (message: any, data?: any) => {
    let id: string | number
    /** Refreshes Sonner's measured height when the nested log changes size. */
    const refreshDescription = () => {
      sonnerToast.error(message, { id, description: makeDescription() })
    }
    /** Creates a new description reference so Sonner measures the updated content. */
    const makeDescription = (): React.ReactNode => typeof data?.description === "string"
      ? React.createElement(ToastErrorDetails, { text: data.description, onExpandedChange: refreshDescription })
      : data?.description
    id = sonnerToast.error(message, {
      duration: 8000,
      ...data,
      className: [data?.className, "vessel-error-toast"].filter(Boolean).join(" "),
      description: makeDescription()
    })
    return id
  },

  /** Performs the warning operation. */
  warning: (message: any, data?: any) => sonnerToast.warning(message, { duration: 6000, ...data }),

  /** Performs the info operation. */
  info: (message: any, data?: any) => sonnerToast.info(message, data)

})

/** Renders the toaster component. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <div
      onPointerDownCapture={(e) => {
        // 如果点击或划选的是文本区域，阻止 pointer capture，保证用户可以随意划词选中文本
        const target = e.target as HTMLElement | null
        if (target && !target.closest("button") && target.closest("[data-content], [data-title], [data-description]")) {
          e.stopPropagation()
        }
      }}
    >
      <Sonner
        className="toaster group"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl text-xs select-text",
            title: "select-text font-semibold",
            description: "group-[.toast]:text-muted-foreground text-xs select-text cursor-text",
            actionButton: "group-[.toast]:bg-stone-900 group-[.toast]:text-stone-50 dark:group-[.toast]:bg-stone-100 dark:group-[.toast]:text-stone-900 text-xs px-2.5 py-1 rounded-md font-medium hover:opacity-90 transition-opacity",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
          }
        }}
        {...props}
      />
    </div>
  )
}

export { toast, Toaster }
