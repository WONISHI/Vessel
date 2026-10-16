# Vessel offline image matting

IMG.LY IS-Net foreground extraction for people and other image subjects. The application uses a local `publicPath`; it never downloads model resources during editing.

Before the first development build, run `npm run assets:matting`. This fetches the pinned 1.7.0 resource manifest, the IS-Net FP16 model, and the matching ONNX Runtime WASM/module. Each chunk is checked for byte length and SHA-256. Approximately 100 MB is stored under `src/renderer/public/vendor/imgly/1.7.0/` and copied into the application by Vite. Build validation fails if resources are missing or corrupted. Model resources are generated assets and are not committed to Git.

After building, validate real inference with network access blocked:

```sh
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron scripts/smoke-image-matting.cjs
```

The package uses `@imgly/background-removal` 1.7.0 and its matching ONNX Runtime 1.21.0, isolated from OCR. See the installed dependency's LICENSE.md and ThirdPartyLicenses.json for licensing information (AGPL-3.0 and third-party notices).
