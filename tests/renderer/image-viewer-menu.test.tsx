import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TransitImageViewer } from '@/components/transit/file-preview/components/transit-image-viewer'
import { ImageFilePreview } from '@/components/image-preview'
vi.mock('@/components/image-preview/editor-sheet', () => ({ ImageEditorSheet: () => null }))
beforeEach(() => {
 vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
 window.electronAPI = { ...window.electronAPI, readImageFile: vi.fn(async () => ({ src: 'data:image/png;base64,AAAA', name: 'photo.png', path: '/vault/photo.png', mime: 'image/png', size: 3, modifiedAt: 0, createdAt: 0 })) }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it.each(['transit', 'workspace'])('supports context menus, zoom and reversible detail hiding in %s', async (viewer) => {
 render(viewer === 'transit' ? <TransitImageViewer src="data:image/png;base64,AAAA" name="photo.png" /> : <ImageFilePreview root="/vault" activeFilePath="/vault/photo.png" />)
 const image = await screen.findByRole('img', { name: 'photo.png' })
 Object.defineProperty(image, 'naturalWidth', { value: 800 })
 Object.defineProperty(image, 'naturalHeight', { value: 600 })
 fireEvent.load(image)
 expect(screen.getByText('图片详细信息')).toBeTruthy()
 fireEvent.contextMenu(image)
 expect(await screen.findByRole('menuitem', { name: '复制' })).toBeTruthy()
 fireEvent.click(screen.getByRole('menuitem', { name: '隐藏详细信息' }))
 expect(screen.queryByText('图片详细信息')).toBeNull()
 fireEvent.contextMenu(image)
 fireEvent.keyDown(screen.getByRole('menuitem', { name: '缩放' }), { key: 'ArrowRight' })
 fireEvent.click(await screen.findByRole('menuitem', { name: '放大' }))
 if (viewer === 'transit') expect(image.parentElement?.parentElement?.parentElement?.style.width).toBe('1000px')
 else expect(screen.getByRole('slider', { name: '调整图片宽度' }).getAttribute('aria-valuenow')).toBe('600')
 fireEvent.contextMenu(image)
 fireEvent.keyDown(screen.getByRole('menuitem', { name: '缩放' }), { key: 'ArrowRight' })
 fireEvent.click(await screen.findByRole('menuitem', { name: '缩小' }))
 fireEvent.contextMenu(image)
 fireEvent.click(screen.getByRole('menuitem', { name: '显示详细信息' }))
 await waitFor(() => expect(screen.getByText('图片详细信息')).toBeTruthy())
})
