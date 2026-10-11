// @vitest-environment jsdom
import React from "react"
Object.assign(globalThis, { React })
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BackupStatus } from "../../src/renderer/src/components/backup-status"
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
afterEach(cleanup)
it("only shows enabled workspace status and sends the active file on click", async () => {
  let enabled = false
  const runBackup = vi.fn(async () => ({ running: false, time: new Date().toISOString() }))
  Object.defineProperty(window, "electronAPI", { configurable: true, value: {
    getSettings: vi.fn(async () => ({ backup: { enabled, workspacePath: "/notes" } })),
    getBackupStatus: vi.fn(async () => ({ running: false })), runBackup
  } })
  const view = render(<BackupStatus workspace="/notes" file="/notes/current.md" />)
  expect(screen.queryByRole("button")).toBeNull()
  enabled = true
  fireEvent(window, new Event("vessel:settings-saved"))
  await waitFor(() => expect(screen.getByRole("button")).toBeTruthy())
  fireEvent.click(screen.getByRole("button"))
  expect(runBackup).toHaveBeenCalledWith("/notes/current.md", "/notes")
  view.rerender(<BackupStatus workspace="/other" file="/other/file.md" />)
  await waitFor(() => expect(screen.queryByRole("button")).toBeNull())
})
