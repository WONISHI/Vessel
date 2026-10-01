const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

// Convert Monaco's trusted AMD locale to data at build time, without renderer eval.
const filename = require.resolve('monaco-editor/min/vs/nls.messages.zh-cn.js.js')
const context = { define: (_name, factory) => factory() }
vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { timeout: 1000 })
if (!Array.isArray(context._VSCODE_NLS_MESSAGES)) throw new Error('Invalid Monaco Chinese locale')
fs.writeFileSync(path.join(__dirname, '../src/renderer/src/components/core/canvas/variants/code/messages.zh-cn.json'), JSON.stringify(context._VSCODE_NLS_MESSAGES))
