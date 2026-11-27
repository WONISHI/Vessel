import { afterEach, expect, it } from 'vitest'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { base, sourceHash } from '../../packages/@vessel/workspace/scripts/wasm-source-hash.mjs'

const directories: string[] = []
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })
function fixture(crlf = false) {
  const directory = mkdtempSync(join(tmpdir(), 'vessel-wasm-integrity-')); directories.push(directory)
  for (const folder of ['scripts', 'rust/src', 'wasm']) mkdirSync(join(directory, folder), { recursive: true })
  for (const file of ['rust/Cargo.toml', 'rust/Cargo.lock', 'rust/src/main.rs']) {
    const lf = readFileSync(join(base, file), 'utf8').replace(/\r\n/g, '\n')
    writeFileSync(join(directory, file), crlf ? lf.replace(/\n/g, '\r\n') : lf)
  }
  for (const file of ['scripts/check-wasm.mjs', 'scripts/wasm-source-hash.mjs', 'wasm/workspace-index.wasm', 'wasm/workspace-index.build.json']) copyFileSync(join(base, file), join(directory, file))
  return directory
}
function verify(directory: string) {
  return spawnSync(process.execPath, [join(directory, 'scripts/check-wasm.mjs')], { encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } })
}

it('accepts the same committed WASM artifact with LF and Windows CRLF source checkouts', () => {
  const lf = fixture(), crlf = fixture(true)
  expect(sourceHash(lf)).toBe(sourceHash(crlf))
  expect(sourceHash(crlf)).toBe(JSON.parse(readFileSync(join(base, 'wasm/workspace-index.build.json'), 'utf8')).sourceHash)
  expect(verify(lf).status).toBe(0)
  expect(verify(crlf).status).toBe(0)
})

it('still rejects a real Rust source change after normalizing line endings', () => {
  const directory = fixture(true), file = join(directory, 'rust/src/main.rs')
  writeFileSync(file, readFileSync(file, 'utf8') + '\r\n// modified source\r\n')
  const result = verify(directory)
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('Rust source or WASM artifact changed')
})

it('still rejects corruption of the WASM binary with unchanged source', () => {
  const directory = fixture(true), file = join(directory, 'wasm/workspace-index.wasm')
  const bytes = readFileSync(file)
  bytes[bytes.length - 1] ^= 1
  writeFileSync(file, bytes)
  const result = verify(directory)
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('Rust source or WASM artifact changed')
})
