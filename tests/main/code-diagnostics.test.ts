import { expect, it } from "vitest"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { diagnoseCode } from "../../src/main/code-diagnostics-worker"
it("resolves package exports with project NodeNext settings and still reports real errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-types-"))
  try {
    const dependency = join(root, "node_modules/@fixture/graph")
    await mkdir(dependency, { recursive: true })
    await writeFile(join(root, "package.json"), '{"type":"module"}')
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", strict: true, skipLibCheck: true } }))
    await writeFile(join(dependency, "package.json"), JSON.stringify({ name: "@fixture/graph", type: "module", exports: { "./prebuilt": { types: "./prebuilt.d.ts" } } }))
    await writeFile(join(dependency, "prebuilt.d.ts"), "export declare function createAgent(): number;")
    const path = join(root, "index.ts")
    await writeFile(path, "")
    const source = 'import { createAgent } from "@fixture/graph/prebuilt"; const answer: number = createAgent();'
    expect(diagnoseCode(path, source)).toEqual([])
    expect(diagnoseCode(path, source + '\nconst broken: string = answer;').some(error => error.code === 2322)).toBe(true)
    expect(diagnoseCode(path, 'import { missing } from "missing-package";').some(error => error.code === 2307)).toBe(true)
  } finally { await rm(root, { recursive: true, force: true }) }
})
