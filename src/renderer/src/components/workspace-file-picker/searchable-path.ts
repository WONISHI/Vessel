/** Dependency trees and Git internals are not quick-open candidates. */
export const isQuickOpenPath = (path: string) => !/(^|[\\/])(?:node_modules|\.git)(?:[\\/]|$)/.test(path)
