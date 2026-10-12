const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const required = ['v9.3.0.24-1/web-apps/apps/api/documents/api.js', 'v9.3.0.24-1/web-apps/apps/api/documents/preload.html', 'v9.3.0.24-1/web-apps/apps/documenteditor/main/index.html', 'v9.3.0.24-1/sdkjs/word/sdk-all.js', 'x2t/x2t.js', 'x2t/x2t.wasm']
module.exports = async context => {
  const root = context.electronPlatformName === 'darwin' ? path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app', 'Contents/Resources') : path.join(context.appOutDir, 'resources')
  if (context.electronPlatformName === 'win32') {
    const arch = context.arch === 3 ? 'arm64' : 'x64'
    const nativeRoot = path.join(root, 'app.asar.unpacked/node_modules')
    const { verifyPE } = require('./prepare-win-app.cjs')
    const watcher = path.join(nativeRoot, '@parcel', `watcher-win32-${arch}`, 'watcher.node')
    await verifyPE(await fs.access(watcher).then(() => watcher, () => path.join(nativeRoot, '@parcel/watcher/build/Release/watcher.node')), arch)
    await verifyPE(path.join(nativeRoot, 'better-sqlite3/build/Release/better_sqlite3.node'), arch)
    await verifyPE(path.join(nativeRoot, 'node-pty/prebuilds', `win32-${arch}`, 'conpty.node'), arch)
  }
  for (const entry of required) {
    const original = await fs.readFile(path.resolve(__dirname, '../resources/office', entry))
    const packed = await fs.readFile(path.join(root, 'office', entry))
    const hash = bytes => createHash('sha256').update(bytes).digest('hex')
    if (hash(original) !== hash(packed)) throw new Error(`ONLYOFFICE resource corrupted: ${entry}`)
  }
}
