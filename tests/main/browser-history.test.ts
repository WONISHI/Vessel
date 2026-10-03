import { expect, it } from "vitest"
import { BrowserHistory } from "../../src/main/browser-history"
it("keeps only 30 days, preserves visits and deletes chosen records", () => {
  const history = new BrowserHistory(":memory:")
  const now = Date.now()
  history.add('https://old.test', 'old', now - 31 * 86400000)
  const id = history.add('https://current.test', 'current', now)!
  history.add('file:///secret', 'not a website')
  expect(history.list()).toHaveLength(1)
  history.title(id, 'new title')
  expect(history.list()[0].title).toBe('new title')
  history.delete(id)
  expect(history.list()).toEqual([])
  history.add('https://current.test', 'current')
  history.delete(null)
  expect(history.list()).toEqual([])
  history.close()
})
