import { sourceHash, binaryHash } from './wasm-source-hash.mjs'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const base = fileURLToPath(new URL('..', import.meta.url))
execFileSync(process.env.CARGO || 'cargo', ['build', '--locked', '--release', '--target', 'wasm32-wasip1'], { cwd: join(base, 'rust'), stdio: 'inherit' })
mkdirSync(join(base, 'wasm'), { recursive: true })
copyFileSync(join(base, 'rust/target/wasm32-wasip1/release/vessel-workspace-index.wasm'), join(base, 'wasm/workspace-index.wasm'))

chmodSync(join(base, 'wasm/workspace-index.wasm'), 0o644)
writeFileSync(join(base, 'wasm/workspace-index.build.json'), JSON.stringify({ target: 'wasm32-wasip1', sourceHash: sourceHash(), binaryHash: binaryHash(readFileSync(join(base, 'wasm/workspace-index.wasm'))) }, null, 2) + '\n')
