import { expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveCodeDefinitions } from '@main/diagnostics/resolve-code-definitions'

it('resolves Vue template bindings, components, aliases and cross-file TypeScript definitions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vessel-definitions-'))
  const path = join(root, 'src/App.vue')
  try {
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }))
    await writeFile(join(root, 'src/Child.vue'), '<template>child</template>')
    await writeFile(join(root, 'src/service.ts'), 'export function submit() { return 1 }\nexport const service = { save() {} }')
    const content = `<template>\n<Child :value="profile" @change="handleChange" />\n<child />\n{{ submit() }}\n{{ missing }}\n</template>\n<script setup lang="ts">\nimport Child from '@/Child.vue'\nimport { submit, service } from '@/service'\nconst profile = { name: '' }\nfunction handleChange() { submit(); service.save() }\nfunction hidden() { const missing = 1; return missing }\n</script>`
    await writeFile(path, content)
    const lookup = (word: string, shift = 1) => resolveCodeDefinitions({ path, content, offset: content.indexOf(word) + shift })
    expect(lookup('Child')[0]).toMatchObject({ path: join(root, 'src/Child.vue'), lineNumber: 1 })
    expect(lookup('child')[0]?.path).toBe(join(root, 'src/Child.vue'))
    expect(lookup('profile')[0]).toMatchObject({ path, lineNumber: 10, column: 7 })
    expect(lookup('handleChange')[0]).toMatchObject({ path, lineNumber: 11, column: 10 })
    expect(lookup('submit()')[0]).toMatchObject({ path: join(root, 'src/service.ts'), lineNumber: 1, column: 17 })
    expect(lookup('@/service')[0]?.path).toBe(join(root, 'src/service.ts'))
    expect(lookup('save()')[0]?.path).toBe(join(root, 'src/service.ts'))
    expect(lookup('missing')).toEqual([])
    expect(lookup('<template>', 2)).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
})

it('uses the current editor text and respects local lexical shadowing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vessel-definitions-'))
  try {
    const path = join(root, 'index.ts')
    await writeFile(path, 'const value = "stale disk content"')
    const content = 'const value = 1;\nfunction run() { const value = 2; return value }\nrun(); value'
    const definitions = (offset: number) => resolveCodeDefinitions({ path, content, offset })
    expect(definitions(content.indexOf('return value') + 9)[0]).toMatchObject({ path, lineNumber: 2, column: 24 })
    expect(definitions(content.lastIndexOf('value') + 1)[0]).toMatchObject({ path, lineNumber: 1, column: 7 })
  } finally { await rm(root, { recursive: true, force: true }) }
})

it('resolves aliases in referenced Vue tsconfigs and dynamic import paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vessel-definitions-'))
  try {
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ files: [], references: [{ path: './tsconfig.app.json' }] }))
    await writeFile(join(root, 'tsconfig.app.json'), JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } }, include: ['src/**/*'] }))
    const target = join(root, 'src/Child.vue')
    await writeFile(target, '<template>child</template>')
    const path = join(root, 'src/App.vue')
    const content = '<template><Child :value="profile" /></template>\n<script setup lang="ts">\nimport Child from "@/Child.vue"\nconst profile = {}\nconst load = () => import("@/Child.vue")\n</script>'
    await writeFile(path, content)
    expect(resolveCodeDefinitions({ path, content, offset: content.indexOf('Child') + 2 })[0]?.path).toBe(target)
    expect(resolveCodeDefinitions({ path, content, offset: content.lastIndexOf('@/Child.vue') + 4 })[0]?.path).toBe(target)
    expect(resolveCodeDefinitions({ path, content, offset: content.indexOf('profile') + 'profile'.length })[0]).toMatchObject({ path, lineNumber: 4, column: 7 })
  } finally { await rm(root, { recursive: true, force: true }) }
})
