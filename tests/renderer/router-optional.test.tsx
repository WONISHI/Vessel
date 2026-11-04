import { renderHook, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { useRouter } from '@vessel/react-router'
afterEach(cleanup)
it('allows a standalone preview to opt out of workspace navigation context', () => {
  const { result } = renderHook(() => useRouter({ optional: true }))
  expect(result.current).toBeNull()
})

import { render, screen } from '@testing-library/react'
import { LinkInteractionArea } from '@/components/ui/link'
it('renders standalone preview link interactions without a workspace router', () => {
  render(<LinkInteractionArea><p>Standalone preview</p></LinkInteractionArea>)
  expect(screen.getByText('Standalone preview')).toBeTruthy()
})
