import { expect, it, vi } from "vitest"
import { createCredentialHandler } from "@main/modules/git/credential-handler"

it("stores only approved credentials, preserves the credential context, and erases rejected credentials", async () => {
  const storage = { read: vi.fn().mockResolvedValue({ username: "user", password: "token" }), save: vi.fn(), erase: vi.fn() }
  const reject = vi.fn(), warning = vi.fn(), handle = createCredentialHandler(storage, reject, warning)
  const input = "protocol=http\nhost=git.test:8090\npath=repo.git\nusername=user\n"
  expect(await handle("get", input)).toBe("username=user\npassword=token\n\n")
  expect(storage.save).not.toHaveBeenCalled()
  expect(storage.read).toHaveBeenCalledWith({ origin: "http://git.test:8090", path: "repo.git", username: "user", password: undefined })
  await handle("store", input + "password=token\n")
  expect(storage.save).toHaveBeenCalledWith(expect.objectContaining({ password: "token" }))
  await handle("erase", input + "password=token\n")
  expect(reject).toHaveBeenCalledOnce()
  expect(storage.erase).toHaveBeenCalledWith(expect.objectContaining({ username: "user", password: "token" }))
  storage.read.mockRejectedValueOnce(new Error("locked"))
  expect(await handle("get", input)).toBe("")
  expect(warning).toHaveBeenCalledOnce()
  storage.save.mockClear()
  await handle("store", "protocol=ssh\nhost=git.test\nusername=user\npassword=token\n")
  expect(storage.save).not.toHaveBeenCalled()
})
