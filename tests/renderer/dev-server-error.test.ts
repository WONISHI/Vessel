import { expect, it } from "vitest"
import { devServerError } from "@/pages/browser/dev-server-error"

it("reports local module failures and disconnected Vite clients", () => {
  expect(devServerError("http://localhost:9525/flow/demo", "Uncaught TypeError: Failed to fetch dynamically imported module", 3)).toBeTruthy()
  expect(devServerError("http://127.0.0.1:5173/", "[vite] server connection lost. polling for restart...", 1)).toBeTruthy()
})
it("ignores ordinary warnings and public websites", () => {
  expect(devServerError("http://localhost:9525/", "Missing required prop: fileHost", 2)).toBeUndefined()
  expect(devServerError("https://example.com/", "Uncaught TypeError", 3)).toBeUndefined()
})
