import { it, expect, vi } from 'vitest'
import { runInNewContext } from 'node:vm'
import { prepareExtensionLogin } from '../../src/main/extension-login-compatibility'
it('extends only login-form timeout and resolves the final error without resending authentication actions', async () => {
  let prefilter: Function = () => {}
  const jquery = { ajaxPrefilter: vi.fn(callback => { prefilter = callback }) }
  const context = { window: { jQuery: jquery }, jQuery: jquery, URL, chrome: {runtime:{getURL:(path:string)=>'chrome-extension://test/'+path}} }
  await prepareExtensionLogin({executeJavaScript: async (code:string) => runInNewContext(code,context)} as never)
  const success=vi.fn(), retry=vi.fn()
  const options={url:'https://example.com/page/muser/login',timeout:6000,tryCount:0,retryLimit:1,error:retry}
  prefilter(options,{success})
  expect(options.timeout).toBe(15000)
  options.error.call(options, {status:0}, 'timeout', '')
  expect(retry).toHaveBeenCalledTimes(1)
  expect(success).not.toHaveBeenCalled()
  options.tryCount=1
  options.error.call(options, {status:503}, 'error', '')
  expect(success.mock.calls[0][0].content).toContain('HTTP 503')
  const sending={url:'https://example.com/chromeext/email/sendcode_v2',timeout:6000,error:retry}
  prefilter(sending,{success})
  expect(sending.timeout).toBe(6000)
  expect(sending.error).toBe(retry)
})
