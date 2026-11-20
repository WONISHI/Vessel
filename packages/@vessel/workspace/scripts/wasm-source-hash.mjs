import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
export const base = fileURLToPath(new URL('..', import.meta.url))
export function sourceHash() {
 const hash = createHash('sha256')
 for (const file of ['rust/Cargo.toml', 'rust/Cargo.lock', 'rust/src/main.rs']) hash.update(file).update(readFileSync(join(base, file)))
 return hash.digest('hex')
}
export const binaryHash = bytes => createHash('sha256').update(bytes).digest('hex')
