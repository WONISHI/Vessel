# @vessel/workspace

Workspace relationship graph, separated from Vessel's editor, routing and Electron bridge.

- `rust/`: Rust directory scanner and Markdown parser, compiled to WASI Preview 1.
- `wasm/workspace-index.wasm`: bundled release artifact. End users do not need Rust or network access.
- `src/graph/`: typed graph model, link resolution, search filters, and Barnes–Hut force layout.
- `src/graph/run-index.ts`: Node WASI runner. Electron calls it from a worker thread.
- Vessel UI: `src/renderer/src/components/workspace/graph/` in the application.

## Build

Install Rust 1.85.1 or later and its `wasm32-wasip1` target, then run:

```sh
rustup target add wasm32-wasip1
npm run build:workspace-wasm
```

The Cargo lockfile pins parser dependencies. Keep the compiled WASM in the repository and rebuild it when Rust source changes. Normal Vessel builds copy this artifact via electron-vite's `?asset` support, alongside the separately bundled `workspace-graph-worker.js`; no runtime compilation or downloads occur.

## Data flow and performance

1. The menu supplies the active workspace root through a typed IPC endpoint.
2. Main validates the root and deduplicates scans by its canonical path. A disposable Node worker hosts the WASI scanner. Closing the dialog cancels work when there are no consumers.
3. Rust enumerates files and parses Markdown with `pulldown-cmark`, including wiki links, Markdown links, embeds and tags. Code blocks, inline code and external links do not create note edges.
4. The index is stored in `userData/workspace-graph/<root-sha256>/index.json`. Version, modification timestamp in nanoseconds and byte length determine reuse. Changed files are re-parsed; deleted files disappear. The new index replaces the old file atomically.
5. The model resolves root-relative, note-relative and unqualified links, decoding URL paths and removing heading/block fragments. Ambiguous short names prefer nearby directories, then lexical order. Missing targets remain distinct nodes.
6. The renderer receives paths and graph metadata, not note contents. Canvas draws nodes/edges; a browser worker runs Barnes–Hut force simulation. Labels fade when zoomed out, edge drawing is batched, and adjacency/color matching is cached outside animation frames.

Filesystem I/O still limits cold scans. Rust/WASM does not eliminate disk latency. Warm scans still enumerate and stat files, but avoid reading and parsing unchanged contents. No speculative performance claim is made against Obsidian or the JavaScript implementation.

## Scope and limits

The UI supports global/local graph depth, incoming/outgoing links, search, tags, attachments, existing-only/orphan filters, color groups, arrows, display/force sliders, pointer zoom/pan/node drag, keyboard navigation and node actions. Settings persist per workspace. Refresh performs an incremental rescan; existing workspace change notifications trigger debounced refreshes.

The query language supports plain text, quoted phrases, `path:`, `file:`, `tag:` and `-` exclusions. It is not a complete implementation of Obsidian's search grammar. Time-lapse playback is not implemented.

Hidden directories and `node_modules`, `target`, `vendor`, `dist`, `build` are excluded. Symbolic links are not followed. Markdown files larger than 32 MiB and unreadable/invalid UTF-8 files are reported as warnings, rather than silently treated as fully indexed. The scanner never changes workspace files; only the application cache is written. The trusted WASM is application-bundled; Node's WASI implementation is not relied on as a security boundary for untrusted code.

## Verified benchmark

On the development Mac (Apple Silicon), using Electron's bundled Node and the production-bundled indexing worker, a generated workspace contained 10,000 Markdown notes, 74,143,560 bytes of content, 10,050 graph nodes including tags, and 40,000 edges:

| Measurement | First index | Repeated index |
| --- | ---: | ---: |
| Worker wall time (WASM startup + scan + graph resolution + transfer) | 775 ms | 394 ms |
| Rust scan/parse/cache time | 611 ms | 239 ms |
| Reused files | 0 | 10,000 |
| Re-parsed files | 10,000 | 0 |

These are synthetic local measurements with filesystem caches warmed by fixture creation, not cold-disk measurements or a speed comparison against Obsidian. A separate hidden Electron window verified the actual preload/IPC/worker/dialog/Canvas chain for 10,000 notes and filtering down to a 100-node folder.
