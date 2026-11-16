import { join } from "node:path"

/** spawn cannot execute a path inside Electron's virtual ASAR filesystem. */
export function clipboardHelperPath(directory: string, packaged: boolean): string {
  const physical = packaged ? directory.replace(/([\\/])app\.asar(?=[\\/]|$)/, "$1app.asar.unpacked") : directory
  return join(physical, "vessel-clipboard")
}
