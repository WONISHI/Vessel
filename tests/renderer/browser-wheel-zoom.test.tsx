import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Guest } from '@/pages/browser/components/guest'
import type { Tab } from '@/pages/browser/components/index-shared'
vi.mock('@/hooks/use-dark-appearance', () => ({ useDarkAppearance: () => false }))
vi.mock('@/pages/browser/guest-appearance', () => ({ guestAppearanceScript: () => '' }))
afterEach(cleanup)
it('updates only the source tab zoom and rejects invalid factors', () => {
 const update = vi.fn()
 const result = render(<Guest tab={{ id: 'page', url: 'https://example.com' } as Tab} visible register={vi.fn()} update={update} />)
 const view = result.container.querySelector('webview')!
 const send = (zoom: unknown) => {
  const event = new Event('ipc-message')
  Object.assign(event, { channel: 'vessel-zoom-changed', args: [zoom] })
  act(() => view.dispatchEvent(event))
 }
 send(1.1)
 expect(update).toHaveBeenCalledWith('page', { zoom: 1.1 })
 send(NaN); send(0); send(3); send('1.2')
 expect(update).toHaveBeenCalledOnce()
})
