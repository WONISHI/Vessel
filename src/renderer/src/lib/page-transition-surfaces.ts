/** Native views must provide a DOM frame before View Transitions take snapshots. */
export type PageTransitionSurface = {
  prepare: (token: number) => Promise<void>
  finish: (token: number) => Promise<void>
}
const surfaces = new Set<PageTransitionSurface>()
export function registerPageTransitionSurface(surface: PageTransitionSurface) {
  surfaces.add(surface)
  return () => { surfaces.delete(surface) }
}
export function pageTransitionSurfaces() { return [...surfaces] }
