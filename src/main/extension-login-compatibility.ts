import type { WebContents } from 'electron'

/** The legacy iGuge page loader retries silently and never completes its loading UI on failure. */
export async function prepareExtensionLogin(background: WebContents) {
  await background.executeJavaScript(`(() => {
    if (!window.jQuery || window.__vesselLoginCompatibility) return;
    window.__vesselLoginCompatibility = true;
    jQuery.ajaxPrefilter((options, original) => {
      let url;
      try { url = new URL(options.url); } catch { return; }
      // Only the read-only login form request. Never retry or alter sending codes/logging in.
      if (url.protocol !== 'https:' || url.pathname !== '/page/muser/login') return;
      options.timeout = Math.max(options.timeout || 0, 15000);
      const onError = options.error;
      options.error = function(xhr, status, error) {
        if (this.tryCount < this.retryLimit) { if (onError) onError.call(this,xhr,status,error); return; }
        const detail = xhr.status ? 'HTTP ' + xhr.status : status === 'timeout' ? '连接超时' : '网络连接失败';
        if (typeof original.success === 'function') original.success({
          title: '登录页加载失败',
          content: '<main style="max-width:520px;margin:60px auto;font:15px/1.8 system-ui"><h2>登录页暂时无法加载</h2><p>' + detail + '。扩展服务及备用地址均未成功响应，请检查网络后重新加载页面。</p><a href="' + chrome.runtime.getURL('login.html?/muser/login') + '">重新加载登录页</a></main>'
        });
      };
    });
  })()`)
}
