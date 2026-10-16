// @vitest-environment jsdom
import React from "react"
Object.assign(globalThis, { React })
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SyncDiagnosticsPanel } from "@/pages/settings/components/sync-diagnostics"
afterEach(cleanup)
it("loads diagnostic entries and clears them through the API", async () => {
  let entries = [{ id: "one", time: "2026-10-15T01:00:00Z", type: "error", message: "上传失败", path: "note.md", code: "S3_REQUEST" }]
  const clear = vi.fn(async () => {
    entries = []
  })
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { getBackupLogs: vi.fn(async () => ({ enabled: true, entries })), clearBackupLogs: clear } })
  render(
    <SyncDiagnosticsPanel
      workspace="/notes"
      running={false}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "查看日志" }))
  await waitFor(() => expect(screen.getByRole("log").textContent).toContain("上传失败"))
  expect(screen.getByRole("log").textContent).toContain("note.md")
  fireEvent.click(screen.getByRole("button", { name: "清空日志" }))
  await waitFor(() => expect(screen.getByRole("log").textContent).toContain("暂无诊断记录"))
  expect(clear).toHaveBeenCalledTimes(1)
})
