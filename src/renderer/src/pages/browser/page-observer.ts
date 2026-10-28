/** Runs in the page world so page handlers and history calls are observable. */
export const pageObserverScript = `(() => {
  if (window.__vesselPageObserver) return;
  window.__vesselPageObserver = true;
  const bridge = window.vesselPageBridge;
  if (!bridge) return;
  let lastIcon = '';
  const reportIcon = () => {
    const links = [...document.querySelectorAll('link[rel][href]')];
    const icon = links.find(link => link.rel.toLowerCase().split(/\\s+/).includes('icon'))
      || links.find(link => link.rel.toLowerCase().includes('apple-touch-icon'));
    const href = icon?.href;
    if (href && href !== lastIcon) {
      lastIcon = href;
      bridge.report('favicon', href);
    }
  };
  reportIcon();
  if (document.head) {
    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => { scheduled = false; reportIcon(); });
    }).observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'rel'] });
  }
  const editable = () => {
    let element = document.activeElement;
    while (element && element.shadowRoot && element.shadowRoot.activeElement) element = element.shadowRoot.activeElement;
    return !!element && (element.matches('input:not([type=button]):not([type=submit]),textarea,select,[role=textbox]') || element.isContentEditable);
  };
  const focus = () => bridge.report('focus', editable());
  document.addEventListener('focusin', focus, true);
  document.addEventListener('focusout', () => setTimeout(focus, 0), true);
  window.addEventListener('blur', () => bridge.report('focus', false));
  focus();
  window.addEventListener('keydown', event => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'f') return;
    const previousFocus = document.activeElement;
    setTimeout(() => {
      const handled = event.defaultPrevented || document.activeElement !== previousFocus;
      bridge.report('search-handled', handled);
      if (!handled) bridge.report('find', true);
    }, 0);
  }, true);
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name];
    history[name] = function(state, title, url) {
      if (url != null) {
        const target = new URL(String(url), location.href);
        // Preserve native errors and state-only updates without showing a dialog.
        if (target.origin === location.origin && target.href !== location.href && !bridge.navigate(target.href)) return;
      }
      const result = original.apply(this, arguments);
      bridge.report('navigation', location.href);
      return result;
    };
  }
  window.addEventListener('popstate', () => bridge.report('navigation', location.href));
  window.addEventListener('hashchange', () => bridge.report('navigation', location.href));
})()`
