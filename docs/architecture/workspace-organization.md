# Workspace organization

Workspace packages live in `packages/@vessel/<name>` and keep their existing `@vessel/<name>` npm identities, for example `packages/@vessel/utils` and `packages/@vessel/sync`.

## Route and component ownership

Route entries live at `pages/<route>/index.tsx`. A nested route owns its own folder, such as `pages/debug/storage/index.tsx`, with private UI in `pages/debug/storage/components`.

Components shared by sibling routes belong to their nearest common route's `components` directory. For example, console and storage share `pages/debug/components/page-back-button.tsx`, while the storage table and cell renderers stay in `pages/debug/storage/components`. Components shared across top-level routes belong in `src/components`: workspace views, the image toolbox, application layout and workspace route caching all follow this rule.

Each module contains at most one JSX component declaration, including class-based components. Pure constants, hooks and type modules use `.ts`; modules that contain JSX use `.tsx`. Application/window bootstrap files remain entry points.

## Shared code and contracts

`@vessel/utils` contains reusable image operations, matte refinement, annotation drawing, display formatting, class-name merging and other helpers. Browser-only utilities use subpath exports so Node entry points do not load DOM dependencies.

`@vessel/type` contains cross-feature and cross-process contracts, including image geometry, annotations, file trees, Git responses, API-client records and workspace summaries. Feature-private component props stay beside their component.

## Imports and documentation

Application imports use `@/`, `@main/`, `@preload/` and `@resources/`. Tests use `@tests/`. Workspace-internal imports use package-specific `#vessel-<package>/...` aliases declared with standard package.json imports. Sync aliases resolve source types during compilation and compiled JavaScript at runtime, retaining npm-package usability.

Node build/smoke scripts use `#vessel-scripts/` and `#vessel-main/`. Smoke scripts that transpile TypeScript install the shared runtime alias resolver. Relative module imports are prohibited; resource URLs and JavaScript injected into external Chromium pages retain their own URL-resolution semantics.

Named function implementations, component functions, class methods and named callback wrappers have JSDoc comments and blank-line separation. Anonymous event callbacks remain documented through their surrounding operation.

## Validation

Run `npm run check:conventions`, `npm run typecheck`, `npm test -- run`, and `npm run build`. Native macOS file-watcher tests require FSEvents access outside a restrictive sandbox. Tests use Node for main/workspace packages and jsdom for renderer code. Build the publishable sync package with `npm run build:sync` and the extension with `npm run build:clipper`.

## Build policy

Renderer output uses esbuild minification and skips gzip-size calculation. Static editor/runtime assets are copied only when size or timestamp changes; model validation remains enabled. Offline image-removal models and required Office/OCR resources are retained. Renderer-only dependencies belong in devDependencies to avoid shipping a second copy in packaged node_modules. Main/preload external dependencies remain runtime dependencies.
