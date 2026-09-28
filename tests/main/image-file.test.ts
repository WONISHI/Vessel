import {expect,it} from "vitest"
import {mkdtemp,writeFile,rm,mkdir} from "node:fs/promises"
import {join} from "node:path"
import {tmpdir} from "node:os"
import {readImageFile} from "../../src/main/modules/files/image-file"
it("returns WebP MIME and original metadata and rejects files outside the workspace",async()=>{
 const root=await mkdtemp(join(tmpdir(),"vessel-image-"))
 try{
 const path=join(root,"photo.webp")
 await writeFile(path,Buffer.from("RIFFtestWEBP"))
 const file=await readImageFile(root,path)
 expect(file.mime).toBe("image/webp")
 expect(file.src).toBe("data:image/webp;base64,UklGRnRlc3RXRUJQ")
 expect(file.size).toBe(12)
 expect(Number.isFinite(Date.parse(file.modifiedAt))).toBe(true)
 await mkdir(join(root,"nested"))
 await expect(readImageFile(join(root,"nested"),path)).rejects.toThrow("不在当前工作区")
 }finally{await rm(root,{recursive:true,force:true})}
})
