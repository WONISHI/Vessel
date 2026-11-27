import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
export const base = fileURLToPath(new URL('..', import.meta.url))
export function sourceHash(directory = base) {
 const hash = createHash('sha256')
 // Git may check text out as CRLF on Windows. Hash canonical LF source on every platform.
 for (const file of ['rust/Cargo.toml', 'rust/Cargo.lock', 'rust/src/main.rs']) hash.update(file).update(readFileSync(join(directory, file), 'utf8').replace(/\r\n/g, '\n'))
 return hash.digest('hex')
}
export const binaryHash = bytes => createHash('sha256').update(bytes).digest('hex')
