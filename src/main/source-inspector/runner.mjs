// Runs with the selected project's Node/Vite/Vue, outside Electron's module graph.
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, isAbsolute } from 'node:path'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

const root = process.cwd(), require = createRequire(join(root, 'package.json'))
const send = message => { if (process.connected) process.send?.(message, () => {}) }
let server
try {
  const vitePackage = require.resolve('vite/package.json')
  const { createServer } = await import(pathToFileURL(join(dirname(vitePackage), 'dist/node/index.js')).href)
  const sfcPath = require.resolve('vue/compiler-sfc')
  const { parse } = require(sfcPath)
  const compilerRequire = createRequire(createRequire(sfcPath).resolve('@vue/compiler-sfc'))
  const MagicString = compilerRequire('magic-string')
  const token = randomBytes(32).toString('hex')
  const locations = new Map()
  let sequence = 0
  const clientPath = '/__vessel_source_client.js'
  const client = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
  const plugin = {
    name: 'vessel-source-inspector', enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.vue') || id.includes('/node_modules/')) return
      const offset = relative(root, id)
      if (offset === '..' || offset.startsWith('../') || isAbsolute(offset)) return
      const { descriptor, errors } = parse(code, { filename: id })
      if (errors.length || !descriptor.template?.ast || descriptor.template.src || (descriptor.template.lang && descriptor.template.lang !== 'html')) return
      // Store only the current version of each file; HMR replaces stale locations.
      for (const [key, value] of locations) if (value.file === id) locations.delete(key)
      const output = new MagicString(code)
      function visit(node) {
        if (node.type === 1 && node.tagType === 0 && !['template', 'slot', 'script', 'style'].includes(node.tag)) {
          const key = String(++sequence)
          locations.set(key, { file: id, line: node.loc.start.line, column: node.loc.start.column })
          output.appendLeft(node.loc.start.offset + 1 + node.tag.length, ` data-vessel-source="${key}"`)
        }
        for (const child of node.children || []) visit(child)
      }
      visit(descriptor.template.ast)
      return { code: output.toString(), map: output.generateMap({ hires: true, source: id, includeContent: true }) }
    },
    transformIndexHtml() { return [{ tag: 'script', attrs: { type: 'module', src: clientPath }, injectTo: 'head-prepend' }] },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        if (pathname === clientPath && req.method === 'GET') {
          res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store')
          res.end(client.replaceAll('__VESSEL_TOKEN__', token)); return
        }
        if (pathname !== '/__vessel_source_open') return next()
        if (req.method !== 'POST' || req.headers['x-vessel-source-token'] !== token) { res.statusCode = 403; res.end('Forbidden'); return }
        let body = ''
        req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy() })
        req.on('end', () => {
          try {
            const { key } = JSON.parse(body), location = locations.get(key)
            if (!location) throw Error('此元素位置已失效，请刷新页面后重试')
            const requestId = randomBytes(12).toString('hex')
            const timer = setTimeout(() => finish('编辑器响应超时'), 18000)
            const reply = message => { if (message.type === 'opened' && message.requestId === requestId) finish(message.error) }
            function finish(error) { clearTimeout(timer); process.off('message', reply); res.statusCode = error ? 400 : 200; res.end(error || 'ok') }
            process.on('message', reply)
            send({ type: 'open', requestId, ...location })
          } catch (error) { res.statusCode = 400; res.end(error.message) }
        })
      })
    }
  }
  const options = JSON.parse(process.argv[2])
  const major = Number(JSON.parse(readFileSync(vitePackage, 'utf8')).version.split('.')[0])
  server = await createServer({ root, configFile: options.config || undefined, mode: options.mode || 'development', cacheDir: join(dirname(fileURLToPath(import.meta.url)), 'vite-cache'), ...(major >= 6 ? { configLoader: 'runner' } : {}), plugins: [plugin], server: { host: 'localhost', open: false, ...(options.port ? { port: options.port } : {}) } })
  if (!server.config.plugins.some(plugin => plugin.name === 'vite:vue')) throw Error('所选项目未启用 Vue 3 Vite 插件（@vitejs/plugin-vue）')
  if (server.config.server.https) throw Error('第一版暂不支持 HTTPS 开发服务，请选择 HTTP 开发配置')
  await server.listen()
  const address = server.httpServer.address()
  send({ type: 'ready', url: `http://localhost:${address.port}${server.config.base.startsWith('/') ? server.config.base : '/'}` })
} catch (error) { send({ type: 'error', error: error.stack || String(error) }); await server?.close(); process.exit(1) }
let closing = false
async function close() {
  if (closing) return
  closing = true
  // Vite optimization/HMR or keep-alive requests must not keep a stopped project alive.
  setTimeout(() => process.exit(0), 2000).unref()
  server?.httpServer?.closeAllConnections?.()
  await server?.close()
  process.exit(0)
}
process.on('SIGTERM', close)
process.on('SIGINT', close)
process.on('disconnect', close)
