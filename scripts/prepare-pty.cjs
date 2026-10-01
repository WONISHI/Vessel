const { chmodSync, existsSync } = require('node:fs')
const { dirname, join } = require('node:path')
const root = dirname(require.resolve('node-pty/package.json'))
for (const arch of ['arm64', 'x64']) {
  const helper = join(root, 'prebuilds', `darwin-${arch}`, 'spawn-helper')
  if (existsSync(helper)) chmodSync(helper, 0o755)
}
