import { type ReactNode } from "react"

/** Renders the row component. */
export function Row({ title, description, children, className }: { title: string; description?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`settings-row${className ? ` ${className}` : ""}`}>
      <div className="min-w-0">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
