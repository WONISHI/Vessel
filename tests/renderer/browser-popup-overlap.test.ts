import { expect, it } from 'vitest'
import { popupOverlapsPane } from '@/pages/browser/popup-overlap'
const pane={left:960,right:1400,top:160,bottom:900,width:440,height:740}
it('keeps right-docked DevTools visible when the left activity menu opens',()=>{
 expect(popupOverlapsPane({left:52,right:280,top:300,bottom:480,width:228,height:180},pane)).toBe(false)
})
it('hides the native view for a portal that actually overlaps it',()=>{
 expect(popupOverlapsPane({left:900,right:1100,top:200,bottom:400,width:200,height:200},pane)).toBe(true)
 expect(popupOverlapsPane({left:960,right:960,top:200,bottom:200,width:0,height:0},pane)).toBe(false)
})
