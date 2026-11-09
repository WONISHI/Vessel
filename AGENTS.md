# Agent notes

## Verification
- Typecheck: `npx tsc --noEmit -p tsconfig.web.json` and `npx tsc --noEmit -p tsconfig.node.json` (ignore pre-existing TS6307 "not listed within the file list" errors).
- Lint a file: `npx eslint <paths>`.
- Tests: the repo pins Node 20, but jsdom (renderer tests) needs Node 22 and better-sqlite3 is built for Electron's ABI. Run vitest with Electron's bundled Node:
  `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/Electron.app/Contents/MacOS/Electron node_modules/vitest/vitest.mjs run <test files>`
  Pure Node tests (no sqlite/jsdom) also run with `npx vitest run <file>`.

## Conventions
- `window.prompt` does not work in Electron; use a dialog component instead.
- Radix `Select` inside a `<form>` can emit `onValueChange("")` while options load; ignore empty values.
