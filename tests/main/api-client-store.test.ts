import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { ApiClientStore } from "@main/modules/api-client/store"
import type { ApiRequestRecord } from "@vessel/type"

const request = (id: string, collectionId: string | null, extra: Partial<ApiRequestRecord> = {}): ApiRequestRecord => ({ id, collectionId, name: id, method: "GET", url: "https://x.test", headers: "[]", params: "[]", bodyType: "raw", bodyContent: "{}", rawType: "json", authType: "none", authConfig: "{}", tests: "", preRequest: "pm.environment.set('a', 1)", updatedAt: 0, ...extra })

it("persists folders, ordering, duplicates, imports, raw types, pre-request scripts and cookies", () => {
  const directory = mkdtempSync(join(tmpdir(), "vessel-api-"))
  let store = new ApiClientStore(join(directory, "api.sqlite"))
  try {
    store.saveCollection({ id: "c1", name: "C1" })
    store.saveCollection({ id: "f1", name: "Folder", parentId: "c1" })
    store.saveRequest(request("r1", "c1"))
    store.saveRequest(request("r2", "c1"))
    store.saveRequest(request("r3", "f1"))
    expect(store.listRequests("c1").map((item) => item.id)).toEqual(["r1", "r2"])
    expect(store.listRequests("c1")[0]).toMatchObject({ rawType: "json", preRequest: "pm.environment.set('a', 1)", sortOrder: 0 })

    const copy = store.duplicateRequest("r1")
    expect(store.listRequests("c1").map((item) => item.name)).toEqual(["r1", "r1 副本", "r2"])

    store.reorder([{ kind: "request", id: "r2", parentId: "f1", sortOrder: 0 }, { kind: "request", id: "r3", parentId: "f1", sortOrder: 1 }])
    expect(store.listRequests("f1").map((item) => item.id)).toEqual(["r2", "r3"])
    expect(() => store.reorder([{ kind: "collection", id: "c1", parentId: "f1", sortOrder: 0 }])).toThrow()

    store.importItems({ collections: [{ id: "c2", name: "Imported", parentId: null }], requests: [request("r9", "c2", { rawType: undefined })] })
    expect(store.listCollections().map((item) => item.id)).toEqual(["c1", "f1", "c2"])

    store.saveCookies([{ domain: "x.test", path: "/", name: "sid", value: "1", expires: null, secure: false, httpOnly: true }, { domain: "x.test", path: "/", name: "old", value: "1", expires: Date.now() - 1, secure: false, httpOnly: false }])
    store.close()
    store = new ApiClientStore(join(directory, "api.sqlite"))
    expect(store.listCookies()).toEqual([{ domain: "x.test", path: "/", name: "sid", value: "1", expires: null, secure: false, httpOnly: true }])
    expect(store.deleteCookies({ domain: "x.test", path: "/", name: "sid" })).toEqual([])

    store.deleteCollection("c1")
    expect(store.listCollections().map((item) => item.id)).toEqual(["c2"])
    expect(store.listRequests().map((item) => item.id)).toEqual(["r9"])
    expect(copy.id).not.toBe("r1")
  } finally {
    store.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
