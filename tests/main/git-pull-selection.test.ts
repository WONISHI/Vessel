import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { gitService } from '../../src/main/modules/git/git-service'

it.each(['merge','pending','rebase'] as const)('pulls selected remote with %s options', async (mode) => {
 const directory = await mkdtemp(join(tmpdir(),'vessel-pull-'))
 const source = join(directory,'source'), local = join(directory,'local'), remote = join(directory,'remote.git')
 const git = (cwd:string,...args:string[]) => execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 const identity = (cwd:string) => { git(cwd,'config','user.name','Test'); git(cwd,'config','user.email','test@example.com'); git(cwd,'config','commit.gpgsign','false') }
 try {
  await mkdir(source)
  git(source,'init','--quiet','--initial-branch=main'); identity(source)
  await writeFile(join(source,'base'),'base'); git(source,'add','.'); git(source,'commit','-m','base')
  git(directory,'init','--quiet','--bare',remote); git(source,'remote','add','origin',remote); git(source,'push','origin','main')
  git(directory,'clone','--quiet','--branch','main',remote,local); identity(local)
  await writeFile(join(source,'remote-change'),'remote'); git(source,'add','.'); git(source,'commit','-m','remote update'); git(source,'push','origin','main')
  await writeFile(join(local,'local-change'),'local'); git(local,'add','.'); git(local,'commit','-m','local update')
  await gitService.pull(local,'origin','main',{commit:mode!=='pending',log:true,noFastForward:true,rebase:mode==='rebase'})
  await access(join(local,'remote-change')); await access(join(local,'local-change'))
  if (mode==='pending') await access(join(local,'.git','MERGE_HEAD'))
  else {
   const parents = git(local,'rev-list','--parents','-n','1','HEAD').split(' ')
   expect(parents).toHaveLength(mode==='merge'?3:2)
   if(mode==='merge') expect(git(local,'log','-1','--format=%B')).toContain('remote update')
  }
 } finally { await rm(directory,{recursive:true,force:true}) }
})
