import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { gitService } from '../../src/main/modules/git/git-service'
it('fetches all remotes and applies prune/tags to the chosen scope', async () => {
 const dir = await mkdtemp(join(tmpdir(),'vessel-fetch-'))
 const source=join(dir,'source'), local=join(dir,'local'), remote=join(dir,'remote.git')
 const git=(cwd:string,...args:string[])=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try {
  await mkdir(source); await mkdir(local)
  git(source,'init','--quiet','--initial-branch=main'); git(source,'config','user.name','Test'); git(source,'config','user.email','test@example.com'); git(source,'config','commit.gpgsign','false')
  git(source,'commit','--allow-empty','-m','base'); git(source,'branch','obsolete')
  git(dir,'init','--quiet','--bare',remote); git(source,'remote','add','origin',remote); git(source,'push','origin','main','obsolete')
  git(local,'init','--quiet'); git(local,'remote','add','origin',remote); git(local,'remote','add','backup',remote)
  await gitService.fetch(local,'origin',{all:true,prune:false,tags:false})
  expect(git(local,'rev-parse','origin/obsolete')).toBe(git(local,'rev-parse','backup/obsolete'))
  git(source,'push','origin','--delete','obsolete'); git(source,'-c','tag.gpgsign=false','tag','release'); git(source,'push','origin','refs/tags/release')
  await gitService.fetch(local,'origin',{all:false,prune:true,tags:true})
  expect(()=>git(local,'rev-parse','--verify','refs/remotes/origin/obsolete')).toThrow()
  expect(git(local,'rev-parse','backup/obsolete')).toBeTruthy()
  expect(git(local,'rev-parse','refs/tags/release')).toBe(git(source,'rev-parse','release'))
  await gitService.fetch(local,'origin',{all:true,prune:true,tags:false})
  expect(()=>git(local,'rev-parse','--verify','refs/remotes/backup/obsolete')).toThrow()
 } finally { await rm(dir,{recursive:true,force:true}) }
})
