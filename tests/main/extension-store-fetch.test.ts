import { EventEmitter } from "node:events"
import { expect, it, vi } from "vitest"
const mock = vi.hoisted(()=>({request:vi.fn()}))
vi.mock("electron",()=>({net:{request:mock.request}}))
import {storeSessionFetch} from "@main/browser/extensions/extension-store-fetch"
function createRequest() { const req=new EventEmitter() as any;req.abort=vi.fn();req.end=vi.fn();req.followRedirect=vi.fn();mock.request.mockReturnValue(req);return req }
it("在 Electron redirect 事件中同步继续，保留最终响应内容",async()=>{
 const req=createRequest();const signal=new AbortController().signal
 const promise=storeSessionFetch({} as any,"https://clients2.google.com/start",{signal})
 req.emit("close");expect(req.abort).not.toHaveBeenCalled()
 req.emit("redirect",302,"GET","https://clients2.googleusercontent.com/file",{})
 expect(req.followRedirect).toHaveBeenCalledTimes(1)
 const response=new EventEmitter() as any;response.headers={"content-type":"application/octet-stream"};response.statusCode=200
 req.emit("response",response)
 const result=await promise
 const body=result.text();req.emit("close");response.emit("data",Buffer.from("test"));response.emit("end");req.emit("close")
 expect(await body).toBe("test")
 expect(req.abort).not.toHaveBeenCalled()
})
it("拒绝非 Google 重定向并终止请求",async()=>{
 const req=createRequest();const promise=storeSessionFetch({} as any,"https://clients2.google.com/start",{})
 req.emit("redirect",302,"GET","https://evil.test/file",{})
 await expect(promise).rejects.toThrow("重定向")
 expect(req.followRedirect).not.toHaveBeenCalled();expect(req.abort).toHaveBeenCalled()
})
it("在响应过程中取消会终止底层请求与读取",async()=>{
 const req=createRequest();const abort=new AbortController();const promise=storeSessionFetch({} as any,"https://clients2.google.com/start",{signal:abort.signal})
 const response=new EventEmitter() as any;response.headers={};response.statusCode=200;req.emit("response",response)
 const result=await promise;const body=result.text();abort.abort()
 await expect(body).rejects.toThrow("取消");expect(req.abort).toHaveBeenCalled()
})
