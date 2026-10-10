const { spawn } = require('node:child_process')
const { createReadStream } = require('node:fs')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: 'inherit', shell: false })
  child.on('error', reject)
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)))
})
async function digest(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
async function main() {
  const args = process.argv.slice(2)
  const arch = args.includes('--arm64') ? 'arm64' : 'x64'
  const version = require('electron/package.json').version
  const name = `electron-v${version}-win32-${arch}.zip`
  const cache = path.resolve('node_modules/.cache/vessel-electron')
  await fs.mkdir(cache, { recursive: true })
  const archive = path.join(cache, name)
  const lock = archive + '.lock'
  let announced = false
  while (true) {
    try { await fs.writeFile(lock, String(process.pid), { flag: 'wx' }); break }
    catch (error) {
      if (error.code !== 'EEXIST') throw error
      const owner = Number(await fs.readFile(lock, 'utf8').catch(() => ''))
      if (owner) {
        try { process.kill(owner, 0) }
        catch (error) { if (error.code === 'ESRCH') { await fs.unlink(lock).catch(() => {}); continue } }
      }
      if (!announced) { console.log('Another Windows build is using this cache; waiting for its download.'); announced = true }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  try {
  const partial = archive + '.partial' 
  const sums = archive + '.sha256'
  const mirrors = [...new Set([process.env.ELECTRON_MIRROR, 'https://npmmirror.com/mirrors/electron/', 'https://github.com/electron/electron/releases/download/'].filter(Boolean))]
  let verified = false
  for (const mirror of mirrors) {
    try {
      const base = `${mirror.replace(/\/$/, '')}/v${version}/`
      await run('curl', ['--fail', '--location', '--retry', '3', '--connect-timeout', '30', '--max-time', '120', '--output', sums, base + 'SHASUMS256.txt'])
      const line = (await fs.readFile(sums, 'utf8')).split('\n').find(line => line.trim().split(/\s+/).at(-1)?.replace(/^\*/, '') === name)
      const expected = line?.split(/\s+/)[0]
      if (!expected || !/^[a-f0-9]{64}$/i.test(expected)) throw new Error('Electron checksum is missing')
      if (await digest(archive).catch(() => '') === expected) { verified = true; break }
      console.log(`Downloading ${name}; interrupted downloads resume from ${partial}`)
      // No ten-minute total timeout. Abort stalled connections, retry and retain partial bytes.
      await run('curl', ['--fail', '--location', '--retry', '6', '--retry-all-errors', '--retry-delay', '2', '--connect-timeout', '30', '--speed-time', '120', '--speed-limit', '1024', '--continue-at', '-', '--output', partial, base + name])
      if (await digest(partial) !== expected) { await fs.unlink(partial); throw new Error('Electron checksum mismatch; retrying another mirror') }
      await fs.rename(partial, archive)
      verified = true; break
    } catch (error) { console.error(`${mirror}: ${error.message}`) }
  }
  if (!verified) throw new Error('Electron download failed. Partial data is preserved; rerun this command to resume.')
  if (args.includes('--download-only')) return
  const cli = require.resolve('electron-builder/cli.js')
  await run(process.execPath, [cli, '--win', `--${arch}`, `--config.electronDist=${archive}`, ...args.filter(arg => !['--arm64', '--x64', '--download-only'].includes(arg))])
  } finally { await fs.unlink(lock).catch(() => {}) }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
