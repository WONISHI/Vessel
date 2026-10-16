/** Performs the initial root operation. */
export function initialRoot() {
  try {
    return JSON.parse(localStorage.getItem("app_current_workspace") || "null")?.path || ""
  } catch {
    return ""
  }
}
