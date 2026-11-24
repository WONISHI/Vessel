import { expect, it } from 'vitest'
import { browserPopupOverlapsPane, popupOverlapsPane } from '@/pages/browser/popup-overlap'
const pane={left:960,right:1400,top:160,bottom:900,width:440,height:740}
it('keeps right-docked DevTools visible when the left activity menu opens',()=>{
 expect(popupOverlapsPane({left:52,right:280,top:300,bottom:480,width:228,height:180},pane)).toBe(false)
})
it('keeps saved-file preview actions above the native console until the toast is dismissed',()=>{
 const toast=document.createElement('li')
 toast.setAttribute('data-sonner-toast','')
 toast.className='vessel-browser-save-toast'
 toast.dataset.visible='true'
 toast.getBoundingClientRect=()=>({left:1000,right:1380,top:800,bottom:880,width:380,height:80} as DOMRect)
 document.body.append(toast)
 try {
  expect(browserPopupOverlapsPane(pane)).toBe(true)
  toast.dataset.removed='true'
  expect(browserPopupOverlapsPane(pane)).toBe(false)
  delete toast.dataset.removed
  toast.dataset.visible='false'
  expect(browserPopupOverlapsPane(pane)).toBe(false)
 } finally { toast.remove() }
})
it('hides the native view for a portal that actually overlaps it',()=>{
 expect(popupOverlapsPane({left:900,right:1100,top:200,bottom:400,width:200,height:200},pane)).toBe(true)
 expect(popupOverlapsPane({left:960,right:960,top:200,bottom:200,width:0,height:0},pane)).toBe(false)
})

it('ignores transparent transit sheet space but detects the actual docked pane', () => {
 const sheet = document.createElement('div')
 sheet.setAttribute('role', 'dialog'); sheet.dataset.state = 'open'; sheet.dataset.transitContainer = ''
 sheet.getBoundingClientRect = () => ({ left:0,right:1400,top:0,bottom:900,width:1400,height:900 } as DOMRect)
 const surface = document.createElement('div'); surface.className = 'transit-sheet'
 surface.getBoundingClientRect = () => ({left:52,right:400,top:0,bottom:900,width:348,height:900} as DOMRect)
 sheet.append(surface); document.body.append(sheet)
 try {
  expect(browserPopupOverlapsPane(pane)).toBe(false)
  surface.getBoundingClientRect = () => ({left:1000,right:1400,top:0,bottom:900,width:400,height:900} as DOMRect)
  expect(browserPopupOverlapsPane(pane)).toBe(true)
 } finally { sheet.remove() }
})

it('keeps address suggestions above DevTools and restores the view when suggestions close', () => {
 const suggestions = document.createElement('div')
 suggestions.className = 'history-completion'
 suggestions.getBoundingClientRect = () => ({left:160,right:1200,top:100,bottom:360,width:1040,height:260} as DOMRect)
 document.body.append(suggestions)
 try {
  expect(browserPopupOverlapsPane(pane)).toBe(true)
  suggestions.getBoundingClientRect = () => ({left:160,right:900,top:100,bottom:360,width:740,height:260} as DOMRect)
  expect(browserPopupOverlapsPane(pane)).toBe(false)
  suggestions.getBoundingClientRect = () => ({left:160,right:1200,top:100,bottom:360,width:1040,height:260} as DOMRect)
  expect(browserPopupOverlapsPane(pane)).toBe(true)
 } finally { suggestions.remove() }
 expect(browserPopupOverlapsPane(pane)).toBe(false)
})
