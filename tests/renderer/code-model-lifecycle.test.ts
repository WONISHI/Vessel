import { expect, it, vi } from 'vitest'
import { retainCodeModel } from '@/components/core/canvas/session/code-model'
it('keeps a split document model alive until both editors are released', async () => {
  const model = { isDisposed: () => false, dispose: vi.fn() }
  const first = retainCodeModel({ getModel: () => model } as any)
  const second = retainCodeModel({ getModel: () => model } as any)
  first(); await Promise.resolve()
  expect(model.dispose).not.toHaveBeenCalled()
  second(); await Promise.resolve()
  expect(model.dispose).toHaveBeenCalledOnce()
})
