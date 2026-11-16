import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { bindTaskCheckboxes } from "@/components/core/canvas/variants/markdown/task-checkboxes"
let dispose: (() => void) | undefined
afterEach(async () => { await act(async () => { dispose?.(); await Promise.resolve() }); document.body.innerHTML = ""; vi.unstubAllGlobals(); vi.restoreAllMocks() })

/** Creates a visible native task input with the same viewport structure as Vditor. */
function fixture(readOnly = false) {
  vi.stubGlobal("ResizeObserver", class { observe() { /* jsdom has no layout observer. */ } disconnect() { /* No observer to release. */ } })
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return this instanceof HTMLInputElement
      ? { x: 20, y: 30, left: 20, top: 30, right: 36, bottom: 46, width: 16, height: 16, toJSON() { return {} } }
      : { x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300, toJSON() { return {} } }
  })
  const host = document.createElement("div")
  host.innerHTML = '<div class="vditor-ir"><div class="vditor-reset" contenteditable="true"><ul><li><input type="checkbox">完成任务</li></ul></div></div>'
  document.body.append(host)
  const input = host.querySelector("input")!
  const nativeClick = vi.fn(() => { input.toggleAttribute("checked", input.checked) })
  input.addEventListener("click", nativeClick)
  dispose = bindTaskCheckboxes(host, readOnly)
  return { host, input, nativeClick }
}
it("uses the shadcn checkbox while keeping controls out of saved editor DOM", async () => {
  const { host, input, nativeClick } = fixture()
  const checkbox = await screen.findByRole("checkbox", { name: "完成任务" })
  expect(checkbox.tagName).toBe("BUTTON")
  fireEvent.click(checkbox)
  await waitFor(() => expect(input.checked).toBe(true))
  await waitFor(() => expect(checkbox.getAttribute("data-state")).toBe("checked"))
  expect(nativeClick).toHaveBeenCalledTimes(1)
  expect(host.querySelector(".vditor-reset button")).toBeNull()
  expect(host.querySelector(".vessel-task-checkbox-layer")?.contains(checkbox)).toBe(true)
  expect(checkbox.style.position).toBe("absolute")
})
it("disables task toggling in read-only documents", async () => {
  const { input, nativeClick } = fixture(true)
  const checkbox = await screen.findByRole("checkbox", { name: "完成任务" })
  expect(checkbox.hasAttribute("disabled")).toBe(true)
  fireEvent.click(checkbox)
  expect(input.checked).toBe(false)
  expect(nativeClick).not.toHaveBeenCalled()
})

it("positions controls relative to the editor layer, then removes them when the editor leaves view", async () => {
  const { host, input } = fixture()
  const checkbox = await screen.findByRole("checkbox", { name: "完成任务" })
  const overlay = host.querySelector<HTMLElement>(".vessel-task-checkbox-layer")!
  Object.defineProperty(overlay, "getBoundingClientRect", { value: () => ({ left: 10, top: 20, right: 310, bottom: 320, width: 300, height: 300 }) })
  fireEvent.scroll(window)
  await waitFor(() => expect(checkbox.style.left).toBe("10px"))
  expect(checkbox.style.top).toBe("10px")
  Object.defineProperty(input, "getBoundingClientRect", { value: () => ({ left: 20, top: -30, right: 36, bottom: -14, width: 16, height: 16 }) })
  fireEvent.scroll(window)
  await waitFor(() => expect(screen.queryByRole("checkbox", { name: "完成任务" })).toBeNull())
})

it("restores the local layer after Vditor replaces its initial host contents", async () => {
  const { host } = fixture()
  await screen.findByRole("checkbox", { name: "完成任务" })
  host.innerHTML = '<div class="vditor-ir"><div class="vditor-reset" contenteditable="true"><ul><li><input type="checkbox">新任务</li></ul></div></div>'
  const checkbox = await screen.findByRole("checkbox", { name: "新任务" })
  expect(host.querySelector(".vessel-task-checkbox-layer")?.contains(checkbox)).toBe(true)
  expect(screen.queryByRole("checkbox", { name: "完成任务" })).toBeNull()
})
