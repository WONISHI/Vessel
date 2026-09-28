import {afterEach,expect,it,vi} from "vitest"
import {transformImage} from "../../src/renderer/src/pages/image-preview/transform"
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()})
it("rotates dimensions, crops exact pixels and rejects out-of-bounds crops",async()=>{
 vi.stubGlobal("Image",class{naturalWidth=400;naturalHeight=200;src="";decode(){return Promise.resolve()}})
 const context={translate:vi.fn(),rotate:vi.fn(),scale:vi.fn(),drawImage:vi.fn()}
 vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D)
 const encode=vi.spyOn(HTMLCanvasElement.prototype,"toDataURL").mockReturnValue("data:image/png;base64,result")
 await transformImage("source","right")
 expect(encode.mock.instances[0].width).toBe(200)
 expect(encode.mock.instances[0].height).toBe(400)
 expect(context.rotate).toHaveBeenCalledWith(Math.PI/2)
 await transformImage("source",{x:10,y:20,width:100,height:80})
 expect(context.drawImage).toHaveBeenLastCalledWith(expect.anything(),10,20,100,80,0,0,100,80)
 await expect(transformImage("source",{x:390,y:0,width:100,height:80})).rejects.toThrow("裁剪范围")
})
