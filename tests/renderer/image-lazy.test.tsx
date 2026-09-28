import React from "react"
import {afterEach,expect,it,vi} from "vitest"
import {act,cleanup,fireEvent,render,screen} from "@testing-library/react"
import {Image} from "../../src/renderer/src/components/ui/image"
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it("defers attachment IO until visible and shows loading, success and error art",async()=>{
 let intersect: IntersectionObserverCallback = ()=>{}
 vi.stubGlobal("IntersectionObserver",class {constructor(callback:IntersectionObserverCallback){intersect=callback}observe(){}disconnect(){}})
 const loadSource=vi.fn().mockResolvedValue("data:image/png;base64,test")
 const {rerender}=render(<Image sourceKey="a" loadSource={loadSource} alt="附件"/>)
 expect(screen.getByRole("img",{name:"图片占位图"})).toBeTruthy()
 expect(loadSource).not.toHaveBeenCalled()
 await act(async()=>{intersect([{isIntersecting:true}] as IntersectionObserverEntry[],{} as IntersectionObserver)})
 expect(loadSource).toHaveBeenCalledTimes(1)
 expect(screen.getByRole("img",{name:"正在加载图片"})).toBeTruthy()
 fireEvent.load(screen.getByRole("img",{name:"附件"}))
 expect(screen.queryByRole("img",{name:"正在加载图片"})).toBeNull()
 rerender(<Image sourceKey="b" loadSource={async()=>{throw Error("missing")}}/>)
 expect(screen.getByRole("img",{name:"图片占位图"})).toBeTruthy()
 await act(async()=>{intersect([{isIntersecting:true}] as IntersectionObserverEntry[],{} as IntersectionObserver)})
 expect(screen.getByRole("img",{name:"图片不存在或无法读取"})).toBeTruthy()
})
