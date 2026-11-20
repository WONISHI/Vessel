// @vitest-environment-options {"url":"http://39.106.89.88:8090/users/sign_in"}
import { afterEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ handlers:new Map<string,(...args:any[])=>void>(),send:vi.fn() }))
vi.mock('electron',()=>({ipcRenderer:{on:(name:string,fn:(...args:any[])=>void)=>mock.handlers.set(name,fn),send:mock.send}}))
import { bindVaultForms } from '../../src/preload/vault-forms'
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();vi.useRealTimers()})
it('captures a GitLab-style HTTP IP login and restricts fills to its exact origin',()=>{
 vi.useFakeTimers()
 const listeners=vi.spyOn(window,'addEventListener')
 bindVaultForms()
 document.body.innerHTML='<form id="new_user" action="/users/sign_in" method="post"><input type="hidden" name="authenticity_token" value="test-token"><label for="user_login">用户名或邮箱</label><input id="user_login" name="user[login]" type="text" autocomplete="username"><input id="user_password" name="user[password]" type="password" autocomplete="current-password"><input type="checkbox" name="user[remember_me]"><button type="submit">登录</button></form>'
 const form=document.querySelector('form')!
 const username=document.querySelector<HTMLInputElement>('#user_login')!, password=document.querySelector<HTMLInputElement>('#user_password')!
 for(const field of [username,password]) vi.spyOn(field,'getClientRects').mockReturnValue([{}] as never)
 username.value='gitlab-test-user';password.value='dummy-test-secret'
 const submit=listeners.mock.calls.find(([name])=>name==='submit')![1] as (event:Event)=>void
 submit({isTrusted:false,target:form} as unknown as Event)
 expect(mock.send).not.toHaveBeenCalled()
 submit({isTrusted:true,target:form} as unknown as Event)
 expect(mock.send).toHaveBeenCalledExactlyOnceWith('vault:submit',{username:'gitlab-test-user',password:'dummy-test-secret'})
 username.value='';password.value=''
 const fill=mock.handlers.get('vault:fill')!
 fill({}, {origin:'https://39.106.89.88:8090',username:'wrong',password:'wrong'})
 expect(password.value).toBe('')
 fill({}, {origin:'http://39.106.89.88:8091',username:'wrong',password:'wrong'})
 expect(password.value).toBe('')
 fill({}, {origin:'http://39.106.89.88:8090',username:'saved-user',password:'saved-dummy-secret'})
 expect(username.value).toBe('saved-user');expect(password.value).toBe('saved-dummy-secret')
 mock.send.mockClear()
 form.action='http://other.test/users/sign_in'
 submit({isTrusted:true,target:form} as unknown as Event)
 expect(mock.send).not.toHaveBeenCalled()
})
