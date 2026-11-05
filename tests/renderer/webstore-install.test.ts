import { afterEach, expect, it, vi } from "vitest"
import { bindWebStoreInstall } from "../../src/preload/webstore-install"
const id = "a".repeat(32)
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren() })
it("隐藏原商店按钮，添加 Vessel 安装按钮，拒绝网页伪造点击", () => {
  vi.stubGlobal("location", new URL(`https://chromewebstore.google.com/detail/test/${id}`))
  vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} })
  document.body.innerHTML = '<button disabled>添加至 Chrome</button>'
  const request = vi.fn()
  bindWebStoreInstall(request)
  document.dispatchEvent(new Event("DOMContentLoaded"))
  const install = document.querySelector<HTMLButtonElement>('[data-vessel-store-install]')!
  expect(install?.textContent).toBe("添加至 Vessel")
  expect(install.disabled).toBe(false)
  expect(document.querySelector<HTMLButtonElement>('button[disabled]')?.hidden).toBe(true)
  install.click()
  expect(request).not.toHaveBeenCalled()
})
it("其他站点和商店非详情页面没有安装入口", () => {
  for (const url of ["https://evil.test/detail/"+id, "https://chromewebstore.google.com/"]) {
    vi.stubGlobal("location",new URL(url))
    vi.stubGlobal("MutationObserver",class { observe() {} disconnect() {} })
    document.body.innerHTML='<button>Add to Chrome</button>'
    bindWebStoreInstall(vi.fn())
    document.dispatchEvent(new Event("DOMContentLoaded"))
    expect(document.querySelector('[data-vessel-store-install]')).toBeNull()
  }
})
