# Local ONLYOFFICE runtime

SDK: `wasm-onlyoffice-sdk` (AGPL-3.0-or-later).
Runtime source: https://github.com/oonxt/wasm-onlyoffice-demo/tree/gh-pages
Editor version: v9.3.0.24-1. Runtime files and fonts retain upstream notices.

Download https://codeload.github.com/oonxt/wasm-onlyoffice-demo/tar.gz/refs/heads/gh-pages
Extract `v9.3.0.24-1` and `x2t` into `resources/office`, then run:

```
node scripts/prepare-office.cjs
npm run build
```

The preparation script replaces remote HTML base URLs with local paths and decompresses x2t's Brotli files. electron-builder copies this runtime to the installed app's resources. Runtime assets are intentionally excluded from Git (~700 MB); prepare them before packaging on another machine. No document server is required. Documents are processed in the local browser/WASM runtime. Save As uses a native file dialog. Fonts and format compatibility depend on the upstream runtime.
