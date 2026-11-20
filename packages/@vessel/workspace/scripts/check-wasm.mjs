import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { base, sourceHash, binaryHash } from './wasm-source-hash.mjs'
try {
 const manifest = JSON.parse(readFileSync(join(base, 'wasm/workspace-index.build.json'), 'utf8'))
 const bytes = readFileSync(join(base, 'wasm/workspace-index.wasm'))
 if (manifest.sourceHash !== sourceHash() || manifest.binaryHash !== binaryHash(bytes) || bytes.subarray(0, 4).toString('hex') !== '0061736d') throw new Error('Rust source or WASM artifact changed')
} catch (error) {
 console.error('Workspace graph WASM is missing or stale. Run npm run build:workspace-wasm.\n' + String(error))
 process.exitCode = 1
}
