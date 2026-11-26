import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { useEditorAppearance } from "./state"
import { resolveEditorTheme } from "./themes"
export function useMonacoTheme() {
  return resolveEditorTheme(useEditorAppearance().theme, useDarkAppearance())
}
