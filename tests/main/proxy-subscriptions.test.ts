import { afterEach, expect, it } from "vitest"
import { ProxySubscriptions } from "@main/browser/proxy-subscriptions"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
const temporary: string[] = []
afterEach(async()=>{await Promise.all(temporary.splice(0).map(path=>rm(path,{recursive:true,force:true})))})
async function fixture() {
 const dir=await mkdtemp(join(tmpdir(),"vessel-profiles-"));temporary.push(dir)
 const key=randomBytes(32)
 const codec={isEncryptionAvailable:()=>true,encryptString:(text:string)=>{
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv)
  const data=Buffer.concat([cipher.update(text,"utf8"),cipher.final()])
  return Buffer.concat([iv,cipher.getAuthTag(),data])
 },decryptString:(data:Buffer)=>{
  const decipher=createDecipheriv("aes-256-gcm",key,data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28))
  return Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString("utf8")
 }}
 return {path:join(dir,"profiles.enc"),codec}
}
it("migrates the original encrypted subscription once and persists several named profiles",async()=>{
 const {path,codec}=await fixture()
 const store=new ProxySubscriptions(path,codec,async()=>"https://old.test/sub?token=legacy")
 const legacy=await store.list()
 expect(legacy).toHaveLength(1);expect(legacy[0].name).toBe("原有订阅")
 const [first,second]=await Promise.all([store.save({name:"工作",url:"https://work.test/sub?token=private"}),store.save({name:"个人",url:"https://personal.test/sub"})])
 expect(first.id).not.toBe(second.id)
 expect((await readFile(path)).includes(Buffer.from("private"))).toBe(false)
 const reopened=new ProxySubscriptions(path,codec,async()=>"https://old.test/sub?token=legacy")
 expect(await reopened.list()).toHaveLength(3)
 await reopened.save({...first,name:"工作2"})
 await reopened.remove(second.id)
 expect((await new ProxySubscriptions(path,codec,async()=>"").list()).map(item=>item.name)).toEqual(["原有订阅","工作2"])
})
it("rejects invalid input without changing saved subscriptions",async()=>{
 const {path,codec}=await fixture(),store=new ProxySubscriptions(path,codec,async()=>"")
 await expect(store.save({name:"",url:"https://valid.test"})).rejects.toThrow()
 await expect(store.save({name:"test",url:"file:///etc/passwd"})).rejects.toThrow("HTTP")
 await expect(store.save({id:"missing",name:"test",url:"https://valid.test"})).rejects.toThrow("不存在")
 expect(await store.list()).toEqual([])
})
it("retains session-only profiles without writing plaintext when encryption is unavailable",async()=>{
 const {path,codec}=await fixture()
 const store=new ProxySubscriptions(path,{...codec,isEncryptionAvailable:()=>false},async()=>"")
 await store.save({name:"临时",url:"https://example.test/sub"})
 expect(await store.list()).toHaveLength(1)
 await expect(readFile(path)).rejects.toMatchObject({code:"ENOENT"})
})
it("keeps metadata on renames, invalidates it on URL changes and rejects late responses",async()=>{
 const {path,codec}=await fixture(),store=new ProxySubscriptions(path,codec,async()=>"")
 const item=await store.save({name:"Test",url:"https://old.test/sub"})
 const info={uploaded:10,downloaded:20,total:1000,updatedAt:1}
 await store.setInfo(item.id,info,item.url)
 expect((await store.save({...item,name:"Renamed"})).info).toEqual(info)
 await store.save({...item,url:"https://new.test/sub"})
 await expect(store.setInfo(item.id,info,item.url)).rejects.toThrow("已更新")
 expect((await store.list())[0].info).toBeUndefined()
})
