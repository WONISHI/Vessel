import { expect, it, vi } from "vitest"
import { createMindmapDocument, createMindmapWriter, parseMindmapDocument } from "@/components/core/canvas/variants/mindmap/document"

it("round-trips portable maps and rejects malformed or duplicate nodes", () => {
  const data = parseMindmapDocument(createMindmapDocument("学习计划.mind"))
  expect(data.nodeData.topic).toBe("学习计划")
  expect(data.nodeData.children).toHaveLength(1)
  expect(() => parseMindmapDocument('{"nodeData":{"id":"a","topic":"root","children":[{"id":"a","topic":"duplicate"}]}}')).toThrow("重复")
  expect(() => parseMindmapDocument('{"nodeData":{"id":"a","topic":"root","children":{}}}')).toThrow()
  expect(() => parseMindmapDocument("invalid")).toThrow()
})
it("serializes snapshots and can recover after a write fails", async () => {
  const calls: string[] = []
  let release: () => void = () => {}
  const blocked = new Promise<void>((resolve) => { release = resolve })
  const writer = createMindmapWriter(async (text) => { calls.push(text); if (text === "first") await blocked; if (text === "bad") throw new Error("disk full") })
  const first = writer("first"), second = writer("second")
  await Promise.resolve()
  expect(calls).toEqual(["first"])
  release()
  await Promise.all([first, second])
  expect(calls).toEqual(["first", "second"])
  await expect(writer("bad")).rejects.toThrow("disk full")
  await expect(writer("retry")).resolves.toBeUndefined()
  expect(calls.at(-1)).toBe("retry")
})
