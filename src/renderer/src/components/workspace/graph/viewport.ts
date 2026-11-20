// Large vaults can already be below 2% at fit-to-canvas; keep room to zoom out.
export const MIN_GRAPH_SCALE = 0.0001
export const MAX_GRAPH_SCALE = 12
export const clampGraphScale = (scale: number) => Math.max(MIN_GRAPH_SCALE, Math.min(MAX_GRAPH_SCALE, scale))
