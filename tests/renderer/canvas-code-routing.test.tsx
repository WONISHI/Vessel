import React from "react"
import { render, screen, cleanup } from "@testing-library/react"
import { afterEach, it, expect, vi } from "vitest"
vi.mock("@/components/core/canvas/variants/markdown/index", () => ({ default: () => <div>markdown</div> }))
vi.mock("@/components/core/canvas/variants/media/index", () => ({ default: () => <div>image</div> }))
vi.mock("@/components/core/canvas/variants/code/index", () => ({ default: ({ activeFilePath }: { activeFilePath: string }) => <div>代码：{activeFilePath}</div> }))
import Canvas from "@/components/core/canvas/index"
afterEach(cleanup)
it("routes a selected TS file into the code editor", async () => {
  render(
    <Canvas
      activeFilePath="/vault/test.ts"
      fileType="ts"
    />
  )
  expect(await screen.findByText("代码：/vault/test.ts")).toBeTruthy()
})
