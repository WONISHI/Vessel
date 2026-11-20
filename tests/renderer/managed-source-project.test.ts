import { expect, it } from 'vitest'
import { isManagedSourcePage } from '@/pages/browser/managed-source-project'
const project = { running: true, url: 'http://localhost:9525/app/' }
it.each(['http://localhost:9525/app/', 'http://localhost:9525/app/login?redirect=/home#part', 'http://localhost:9525/app'])('recognizes the active managed page %s', (url) => {
 expect(isManagedSourcePage(url, project)).toBe(true)
})
it.each(['http://localhost:9523/app/login', 'http://127.0.0.1:9525/app/login', 'https://localhost:9525/app/login', 'http://localhost:9525/another/', 'http://localhost:9525/application', 'https://example.com/app/', 'file:///tmp/app.html'])('rejects unrelated page %s', (url) => {
 expect(isManagedSourcePage(url, project)).toBe(false)
})
it('rejects absent, starting and stopped services', () => {
 expect(isManagedSourcePage(project.url, null)).toBe(false)
 expect(isManagedSourcePage(project.url, { ...project, running: false })).toBe(false)
 expect(isManagedSourcePage(project.url, { ...project, url: '' })).toBe(false)
})
