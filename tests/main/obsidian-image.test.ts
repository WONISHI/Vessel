import { expect, it } from "vitest"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { readObsidianImage } from "../../src/main/modules/files/obsidian-image"
it("loads a named workspace attachment and rejects missing references", async () => {
  const root = await mkdtemp(join(tmpdir(),"vessel-obsidian-"))
  try {
    await mkdir(join(root,"images"))
    await writeFile(join(root,"note.md"),"")
    await writeFile(join(root,"images","Pasted image 20260303174838.png"), Buffer.from([137,80,78,71]))
    expect(await readObsidianImage(root,join(root,"note.md"),"![[Pasted image 20260303174838.png]]")).toBe("data:image/png;base64,iVBORw==")
    expect(await readObsidianImage(root,join(root,"note.md"),"![image|925](images/Pasted image 20260303174838.png)")).toBe("data:image/png;base64,iVBORw==")
    await expect(readObsidianImage(root,join(root,"note.md"),"![[missing.png]]")).rejects.toThrow("找不到")
  } finally { await rm(root,{recursive:true,force:true}) }
})
