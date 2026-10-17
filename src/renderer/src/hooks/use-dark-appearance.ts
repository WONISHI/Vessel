import { useEffect, useState } from "react"

/** Tracks the applied appearance for embedded renderers that do not inherit CSS colors. */
export function useDarkAppearance() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return dark
}
