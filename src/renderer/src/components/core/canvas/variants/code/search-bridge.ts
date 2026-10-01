export const codeEditors = new Map<string, { getValue(): string; revealLineInCenter(line: number): void; setPosition(position: { lineNumber: number; column: number }): void; focus(): void }>()
