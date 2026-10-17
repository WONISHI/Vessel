import darkReaderSource from "@resources/vendor/darkreader/darkreader.js?raw"

/** Builds an idempotent page-theme update for an isolated WebView document. */
export function guestAppearanceScript(dark: boolean) {
  if (!dark) return "window.__vesselDarkReader?.disable();"
  return `(() => {
    if (!window.__vesselDarkReader) {
      const exports = {};
      const module = { exports };
      ${darkReaderSource}
      window.__vesselDarkReader = exports;
      window.__vesselDarkReader.setFetchMethod(window.fetch.bind(window));
    }
    window.__vesselDarkReader.enable({
      brightness: 100,
      contrast: 100,
      sepia: 0,
      darkSchemeBackgroundColor: '#22272E',
      darkSchemeTextColor: '#CDD9E5'
    });
  })();`
}
