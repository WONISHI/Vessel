const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const forwarded = args.filter(arg => arg !== '--dry-run')
  const version = require('electron/package.json').version
  const dist = path.join(path.dirname(require.resolve('electron/package.json')), 'dist')
  const binary = path.join(dist, 'Electron.app/Contents/MacOS/Electron')
  const targets = args.filter(arg => ['--arm64', '--x64', '--universal', '--ia32', '--all'].includes(arg))
  const arch = targets.length ? targets[0].slice(2) : process.arch
  const command = ['--mac', ...forwarded]
  let reusable = false
  if (process.platform === 'darwin' && targets.length <= 1 && ['arm64', 'x64'].includes(arch)) {
    try {
      const installedVersion = fs.readFileSync(path.join(dist, 'version'), 'utf8').trim()
      const architectures = execFileSync('lipo', ['-archs', binary], { encoding: 'utf8' }).trim().split(/\s+/)
      reusable = installedVersion === version && architectures.includes(arch === 'x64' ? 'x86_64' : arch)
    } catch {
      // Missing or mismatched local binaries use electron-builder's downloader.
    }
  }
  if (reusable) {
    console.log(`Reusing installed Electron ${version} (${arch}); no Electron download needed.`)
    command.push(`--config.electronDist=${dist}`, `--config.electronVersion=${version}`)
  } else {
    console.log('No matching local Electron distribution; using the configured download mirror/cache.')
  }
  if (dryRun) { console.log(JSON.stringify(command)); return }
  const child = spawn(process.execPath, [require.resolve('electron-builder/cli.js'), ...command], { stdio: 'inherit', shell: false })
  child.on('error', error => { console.error(error.message); process.exitCode = 1 })
  child.on('exit', code => { process.exitCode = code ?? 1 })
}

main()
