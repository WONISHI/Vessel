import { expect, it } from "vitest"
import { ProxyTrafficCounter, subscriptionInfo } from "@main/browser/proxy-metrics"
it("parses provider byte quotas and expiry without inventing missing metadata",()=>{
 expect(subscriptionInfo("upload=10; download=90; total=1000; expire=1800000000",5)).toEqual({uploaded:10,downloaded:90,total:1000,expiresAt:1800000000000,updatedAt:5})
 expect(subscriptionInfo(null,5)).toEqual({updatedAt:5})
 expect(subscriptionInfo("total=-1;upload=NaN;download=1e999;expire=invalid",5)).toEqual({updatedAt:5})
 expect(subscriptionInfo("total=0;expire=0",5)).toMatchObject({total:0,expiresAt:0})
})
it("derives rates from elapsed time and accumulates byte totals across core resets",()=>{
 const counter=new ProxyTrafficCounter(1000,2000,1000)
 let value=counter.sample(100,400,2000)
 expect(value).toMatchObject({uploadRate:100,downloadRate:400,uploaded:100,downloaded:400,totalUploaded:1100,totalDownloaded:2400})
 value=counter.sample(200,800,4000)
 expect(value.uploadRate).toBe(50);expect(value.downloadRate).toBe(200)
 expect(counter.sample(10,30,5000)).toMatchObject({totalUploaded:1210,totalDownloaded:2830,uploadRate:10,downloadRate:30})
 expect(counter.snapshot(false)).toMatchObject({uploadRate:0,downloadRate:0,totalUploaded:1210,totalDownloaded:2830})
 expect(counter.sample(NaN,1,6000).history).toHaveLength(3)
})
it("keeps a bounded recent history",()=>{
 const counter=new ProxyTrafficCounter(0,0,0)
 for(let i=1;i<=100;i++) counter.sample(i*10,i*20,i*1000)
 expect(counter.snapshot().history).toHaveLength(60)
 expect(counter.snapshot().totalDownloaded).toBe(2000)
})
