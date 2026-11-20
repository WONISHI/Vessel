/** Runs on the selected live node, preserving canvas/form state and returning a reversible layout. */
export const nodeScreenshotLayout = `function () {
  const node = this;
  const styles = new Map();
  const positions = new Map();
  const windows = new Map();
  const marked = new Map();
  const masks = [];
  const marker = 'data-vessel-shot-' + Math.random().toString(36).slice(2);
  const remember = element => {
    if (!styles.has(element)) {
      styles.set(element, element.getAttribute('style'));
      positions.set(element, { left: element.scrollLeft, top: element.scrollTop });
    }
  };
  const set = (element, values) => {
    remember(element);
    for (const [key, value] of Object.entries(values)) element.style.setProperty(key, value, 'important');
  };
  const restore = () => {
    masks.forEach(mask => mask.remove());
    for (const [element, value] of marked) {
      if (value === null) element.removeAttribute(marker); else element.setAttribute(marker, value);
    }
    for (const [element, value] of [...styles].reverse()) {
      if (value === null) element.removeAttribute('style'); else element.setAttribute('style', value);
    }
    for (const [element, point] of positions) element.scrollTo?.({ ...point, behavior: 'instant' });
    for (const [window, point] of windows) window.scrollTo({ ...point, behavior: 'instant' });
  };
  try {
    const initial = node.getBoundingClientRect();
    if (!initial.width || !initial.height) throw new Error('该元素没有可截图的显示区域');
    const elements = [node, ...node.querySelectorAll('*')];
    const scrollable = elements.filter(element => {
      const css = element.ownerDocument.defaultView.getComputedStyle(element);
      return (element.scrollHeight > element.clientHeight + 1 && /auto|scroll|hidden|clip/.test(css.overflowY)) ||
        (element.scrollWidth > element.clientWidth + 1 && /auto|scroll|hidden|clip/.test(css.overflowX));
    });
    // A wrapper can start without overflow and become clipped only after a child expands.
    const expanded = new Set(scrollable);
    for (const element of scrollable) {
      for (let parent = element.parentElement; parent && node.contains(parent); parent = parent.parentElement) {
        const css = parent.ownerDocument.defaultView.getComputedStyle(parent);
        if (/auto|scroll|hidden|clip/.test(css.overflowX + css.overflowY)) expanded.add(parent);
      }
    }
    // Keep line wrapping stable while removing ancestor clipping and unrelated overlays.
    set(node, { width: node.offsetWidth + 'px', 'box-sizing': 'border-box', 'max-width': 'none', transition: 'none' });
    for (const element of elements) {
      const css = element.ownerDocument.defaultView.getComputedStyle(element);
      if (css.position === 'fixed' || css.position === 'sticky') set(element, { position: 'static', transition: 'none' });
    }
    for (const element of elements.filter(element => expanded.has(element)).reverse()) {
      const borderX = element.offsetWidth - element.clientWidth;
      const borderY = element.offsetHeight - element.clientHeight;
      const values = { overflow: 'visible', 'max-height': 'none', height: 'auto', 'min-height': element.scrollHeight + borderY + 'px', 'flex-shrink': '0', contain: 'none', 'box-sizing': 'border-box', transition: 'none' };
      if (element.scrollWidth > element.clientWidth + 1) {
        values.width = element.scrollWidth + borderX + 'px';
        values['max-width'] = 'none';
      }
      set(element, values);
      element.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    }
    let branch = node;
    while (branch) {
      const document = branch.ownerDocument;
      const window = document.defaultView;
      if (!windows.has(window)) windows.set(window, { left: window.scrollX, top: window.scrollY });
      const mask = document.createElement('style');
      mask.textContent = '[' + marker + '], [' + marker + '] * { visibility: hidden !important; }';
      (document.head || document.documentElement).append(mask);
      masks.push(mask);
      for (let current = branch; current.parentElement; current = current.parentElement) {
        for (const sibling of current.parentElement.children) {
          if (sibling === current || sibling === mask) continue;
          if (!marked.has(sibling)) marked.set(sibling, sibling.getAttribute(marker));
          sibling.setAttribute(marker, '');
        }
        set(current.parentElement, { overflow: 'visible', contain: 'none', 'content-visibility': 'visible', 'scroll-behavior': 'auto' });
        current.parentElement.scrollTo({ left: 0, top: 0, behavior: 'instant' });
      }
      const frame = window.frameElement;
      if (!frame) break;
      set(frame, { height: document.documentElement.scrollHeight + frame.offsetHeight - frame.clientHeight + 'px', width: Math.max(frame.clientWidth, document.documentElement.scrollWidth) + frame.offsetWidth - frame.clientWidth + 'px', 'max-height': 'none', 'max-width': 'none', 'box-sizing': 'border-box' });
      branch = frame;
    }
    return {
      measure() {
        const rect = node.getBoundingClientRect();
        let x = rect.left, y = rect.top, window = node.ownerDocument.defaultView;
        while (window.frameElement) {
          const frame = window.frameElement;
          const bounds = frame.getBoundingClientRect();
          x += bounds.left + frame.clientLeft;
          y += bounds.top + frame.clientTop;
          window = frame.ownerDocument.defaultView;
        }
        return JSON.stringify({ x: x + window.scrollX, y: y + window.scrollY, width: rect.width, height: rect.height, scale: 1 });
      },
      restore
    };
  } catch (error) { restore(); throw error; }
}`
