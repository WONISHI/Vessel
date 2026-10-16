export type Shape = { kind: "pen" | "rect" | "ellipse" | "arrow" | "text"; color: string; width: number; points: { x: number; y: number }[]; text?: string; size?: number }
