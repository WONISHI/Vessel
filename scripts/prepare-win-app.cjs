const fs = require('node:fs/promises')
const path = require('node:path')
const { createRequire } = require('node:module')
const { spawn } = require('node:child_process')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..')
const run = (command, args, cwd) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, stdio: 'inherit', shell: false })
  child.on('error', reject)
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)))
})
async function download(url, file) {
  const partial = file + '.partial'
  await run('curl', ['--fail', '--location', '--retry', '3', '--retry-all-errors', '--connect-timeout', '30', '--max-time', '180', '--output', partial, url])
  await fs.rename(partial, file)
}
async function verifyPE(file, arch) {
  const bytes = await fs.readFile(file)
  const offset = bytes.length >= 64 ? bytes.readUInt32LE(60) : 0
  if (bytes.toString('ascii', 0, 2) !== 'MZ' || offset + 6 > bytes.length || bytes.toString('ascii', offset, offset + 4) !== 'PE\0\0' || bytes.readUInt16LE(offset + 4) !== (arch === 'arm64' ? 0xaa64 : 0x8664)) throw new Error(`Not a Windows ${arch} binary: ${file}`)
}
function packageDirectory(name, from) {
  const resolve = createRequire(path.join(from, 'package.json'))
  try { return path.dirname(resolve.resolve(name + '/package.json')) }
  catch {
    let directory = path.dirname(resolve.resolve(name))
    while (directory !== path.dirname(directory)) {
      try { if (require(path.join(directory,'package.json')).name === name) return directory } catch {}
      directory = path.dirname(directory)
    }
    throw new Error(`Cannot resolve dependency ${name}`)
  }
}
/** Copy only the production dependency graph, retaining nested version resolution. */
async function copyDependency(name, from, destination, arch, ancestors = new Set()) {
  const source = packageDirectory(name, from)
  if (ancestors.has(source)) return
  const pkg = JSON.parse(await fs.readFile(path.join(source,'package.json'),'utf8'))
  if (pkg.os && (!pkg.os.includes('win32') && !pkg.os.every(os => os.startsWith('!')) || pkg.os.includes('!win32'))) return
  if (pkg.cpu && !pkg.cpu.includes(arch)) return
  await fs.cp(source, destination, { recursive:true, dereference:true, filter: file => path.relative(source,file).split(path.sep)[0] !== 'node_modules' })
  const next = new Set(ancestors).add(source)
  for (const dependency of Object.keys(pkg.dependencies || {})) await copyDependency(dependency, source, path.join(destination,'node_modules',dependency), arch, next)
  // Optional platform packages are installed explicitly below. Host-only packages are omitted.
}
async function prepareWinApp(arch, electronVersion) {
  if (!['x64','arm64'].includes(arch)) throw new Error('Unsupported Windows architecture')
  const cache = path.join(root,'node_modules/.cache/vessel-win-native',`${electronVersion}-${arch}`)
  await fs.mkdir(cache,{recursive:true})
  const app = await fs.mkdtemp(path.join(cache,'app-'))
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'))
    const manifest = Object.fromEntries(['name','version','description','main','author','homepage','license','type','dependencies'].filter(key => pkg[key] !== undefined).map(key => [key,pkg[key]]))
    await fs.writeFile(path.join(app,'package.json'),JSON.stringify(manifest,null,2))
    await fs.cp(path.join(root,'out'),path.join(app,'out'),{recursive:true})
    for (const dependency of Object.keys(pkg.dependencies)) await copyDependency(dependency,root,path.join(app,'node_modules',dependency),arch)
    // @vscode/ripgrep uses an optional package for the target platform.
    const ripgrepManifest = JSON.parse(await fs.readFile(path.join(packageDirectory('@vscode/ripgrep',root),'package.json'),'utf8'))
    const ripgrepName = `ripgrep-win32-${arch}`
    const ripgrepVersion = ripgrepManifest.optionalDependencies[`@vscode/${ripgrepName}`]
    if (!ripgrepVersion) throw new Error(`Ripgrep does not support Windows ${arch}`)
    const ripgrepRegistry = (process.env.npm_config_registry || 'https://registry.npmjs.org').replace(/\/$/,'')
    const ripgrepMetadata = path.join(cache,`${ripgrepName}-${ripgrepVersion}.json`)
    await download(`${ripgrepRegistry}/@vscode%2f${ripgrepName}/${ripgrepVersion}`,ripgrepMetadata)
    const ripgrepDist = JSON.parse(await fs.readFile(ripgrepMetadata,'utf8')).dist
    const [ripgrepAlgorithm,ripgrepExpected] = ripgrepDist.integrity.split('-')
    const ripgrepArchive = path.join(cache,`${ripgrepName}-${ripgrepVersion}.tgz`)
    const validRipgrep = async () => createHash(ripgrepAlgorithm).update(await fs.readFile(ripgrepArchive)).digest('base64') === ripgrepExpected
    if (!await validRipgrep().catch(() => false)) await download(ripgrepDist.tarball,ripgrepArchive)
    if (!await validRipgrep()) throw new Error('Ripgrep package checksum mismatch')
    const ripgrepTarget = path.join(app,'node_modules/@vscode',ripgrepName)
    await fs.mkdir(ripgrepTarget,{recursive:true})
    await run('tar',['-xzf',ripgrepArchive,'--strip-components=1','-C',ripgrepTarget])
    await verifyPE(path.join(ripgrepTarget,'bin/rg.exe'),arch)
    const watcherVersion = require('@parcel/watcher/package.json').version
    const watcherName = `watcher-win32-${arch}`
    const watcherArchive = path.join(cache,`${watcherName}-${watcherVersion}.tgz`)
    const registry = (process.env.npm_config_registry || 'https://registry.npmjs.org').replace(/\/$/,'')
    const metadata = path.join(cache,`${watcherName}-${watcherVersion}.json`)
    await download(`${registry}/@parcel%2f${watcherName}/${watcherVersion}`,metadata)
    const dist = JSON.parse(await fs.readFile(metadata,'utf8')).dist
    const [algorithm, expected] = dist.integrity.split('-')
    const valid = async () => createHash(algorithm).update(await fs.readFile(watcherArchive)).digest('base64') === expected
    if (!await valid().catch(() => false)) await download(dist.tarball,watcherArchive)
    if (!await valid()) throw new Error('Watcher package checksum mismatch')
    const watcher = path.join(app,'node_modules/@parcel',watcherName)
    await fs.mkdir(watcher,{recursive:true})
    await run('tar',['-xzf',watcherArchive,'--strip-components=1','-C',watcher])
    await verifyPE(path.join(watcher,'watcher.node'),arch)
    const sqliteVersion = require('better-sqlite3/package.json').version
    const builderRequire = createRequire(require.resolve('electron-builder'))
    const abi = builderRequire('node-abi').getAbi(electronVersion,'electron')
    const filename = `better-sqlite3-v${sqliteVersion}-electron-v${abi}-win32-${arch}.tar.gz`
    const archive = path.join(cache,filename)
    if (!await fs.stat(archive).then(() => true,()=>false)) await download(`https://github.com/WiseLibs/better-sqlite3/releases/download/v${sqliteVersion}/${filename}`,archive)
    const sqlite = path.join(app,'node_modules/better-sqlite3')
    await fs.rm(path.join(sqlite,'build'),{recursive:true,force:true})
    await run('tar',['-xzf',archive,'-C',sqlite])
    await verifyPE(path.join(sqlite,'build/Release/better_sqlite3.node'),arch)
    // node-pty ships N-API Windows prebuilds and their companion DLL/EXE files.
    const pty = path.join(app,'node_modules/node-pty')
    await fs.rm(path.join(pty,'build'),{recursive:true,force:true})
    for (const target of await fs.readdir(path.join(pty,'prebuilds'))) if (target !== `win32-${arch}`) await fs.rm(path.join(pty,'prebuilds',target),{recursive:true,force:true})
    await verifyPE(path.join(pty,'prebuilds',`win32-${arch}`,'conpty.node'),arch)
    await verifyPE(path.join(pty,'prebuilds',`win32-${arch}`,'conpty_console_list.node'),arch)
    // Remove any host watcher build so it can only resolve the verified Windows package.
    await fs.rm(path.join(app,'node_modules/@parcel/watcher/build'),{recursive:true,force:true})
    console.log(`Prepared Windows ${arch} native dependencies for Electron ${electronVersion} (ABI ${abi})`)
    return app
  } catch (error) { await fs.rm(app,{recursive:true,force:true}); throw error }
}
module.exports = { prepareWinApp, verifyPE }
