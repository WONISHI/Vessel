import { runInNewContext } from "node:vm"
import { expect, it } from "vitest"
import { installBrowserContextMenu } from "../../src/preload/browser-context-menu"

it("shows the fallback even when a webpage registers context-menu listeners without canceling", () => {
  const result = runInNewContext(`
    class EventTarget {
      constructor() { this.handlers = []; }
      addEventListener(type, listener) { this.handlers.push({type, listener}); }
      removeEventListener(type, listener) { this.handlers = this.handlers.filter(h => h.type !== type || h.listener !== listener); }
    }
    const window = new EventTarget(); window.top = window;
    const timers = [], calls = [];
    const setTimeout = fn => timers.push(fn);
    window.vesselContextMenu = details => calls.push(details);
    const originalAdd = EventTarget.prototype.addEventListener;
    (${installBrowserContextMenu.toString()})();
    const target = new EventTarget(), parent = new EventTarget();
    const fire = (trusted = true) => {
      const event = {
        isTrusted: trusted, defaultPrevented: false, clientX: 10, clientY: 20,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.stopped = true; }
      };
      for (const h of [...window.handlers]) h.listener(event);
      for (const element of [target, parent]) {
        for (const h of [...element.handlers]) h.listener(event);
        element.oncontextmenu?.(event);
        if (event.stopped) break;
      }
      while (timers.length) timers.shift()();
    };
    fire(); const empty = calls.length;
    const listener = () => {};
    target.addEventListener('contextmenu', listener); fire(); const own = calls.length;
    parent.addEventListener('contextmenu', listener); fire(); const ancestor = calls.length;
    parent.oncontextmenu = listener; fire(); const property = calls.length;
    target.addEventListener('contextmenu', e => e.stopPropagation()); fire(); const stopped = calls.length;
    fire(false); const untrusted = calls.length;
    ({empty, own, ancestor, property, stopped, untrusted, last: calls.at(-1), unchanged: originalAdd === EventTarget.prototype.addEventListener});
  `)
  expect(result).toEqual({ empty: 1, own: 2, ancestor: 3, property: 4, stopped: 5, untrusted: 5, last: { x: 10, y: 20 }, unchanged: true })
})

it("lets the webpage suppress the fallback during event dispatch", () => {
  const result = runInNewContext(`
    const timers = [], calls = [], handlers = [];
    const window = { addEventListener: (_type, listener) => handlers.push(listener), vesselContextMenu: details => calls.push(details) };
    window.top = window;
    const setTimeout = fn => timers.push(fn);
    (${installBrowserContextMenu.toString()})();
    const event = { isTrusted: true, defaultPrevented: false, clientX: 10, clientY: 20 };
    handlers[0](event);
    // The site's target or bubbling listener cancels after our capture listener runs.
    event.defaultPrevented = true;
    while (timers.length) timers.shift()();
    calls.length;
  `)
  expect(result).toBe(0)
})
