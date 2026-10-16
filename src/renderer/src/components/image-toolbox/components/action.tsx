import { type ReactNode } from "react"

/** Renders the action component. */
export function Action({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className="image-button image-primary"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
