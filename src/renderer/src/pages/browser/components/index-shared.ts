export const PAGE_EXTRACTOR_SCRIPT = `(() => {
  try {
    let selectedText = "";
    let selectedHtml = "";
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        selectedText = sel.toString().trim();
        const range = sel.getRangeAt(0);
        const container = document.createElement("div");
        container.appendChild(range.cloneContents());
        selectedHtml = container.innerHTML;
      }
    } catch (_) {}

    function cleanElement(node) {
      if (!node) return;
      const junkTags = [
        "script", "style", "noscript", "iframe", "svg", "canvas", "video", "audio",
        "nav", "header", "footer", "aside", "form", "button", "input", "select", "textarea",
        "dialog", "[aria-hidden='true']"
      ];
      junkTags.forEach(sel => {
        try {
          node.querySelectorAll(sel).forEach(el => el.remove());
        } catch (_) {}
      });

      const junkClasses = [
        ".sidebar", ".comments", "#comments", ".comment-list", ".ad", ".advertisement",
        ".share-wrap", ".social-share", ".recommend-box", ".related-posts", ".banner",
        ".footer", ".header", "#header", "#footer"
      ];
      junkClasses.forEach(sel => {
        try {
          node.querySelectorAll(sel).forEach(el => el.remove());
        } catch (_) {}
      });

      try {
        const imgs = node.querySelectorAll("img");
        imgs.forEach(img => {
          const realSrc = img.getAttribute("data-src") ||
                          img.getAttribute("data-original") ||
                          img.getAttribute("data-actualsrc") ||
                          img.getAttribute("data-lazy-src") ||
                          img.getAttribute("data-url") ||
                          img.src;
          if (realSrc) {
            if (realSrc.startsWith("data:") && realSrc.length > 50000) {
              img.removeAttribute("src");
            } else {
              img.src = realSrc;
            }
          }
        });
      } catch (_) {}
    }

    function extractArticle() {
      const selectors = [
        "#js_content",
        ".Post-RichText",
        ".RichContent-inner",
        "#content_views",
        ".article-viewer",
        ".markdown-body",
        ".article-holder",
        ".article-content",
        ".entry-content",
        ".post-content",
        "#article-root",
        "#content",
        "article",
        "main",
        "[role='main']",
        ".article",
        ".post_body",
        ".post-body"
      ];

      for (const sel of selectors) {
        try {
          const target = document.querySelector(sel);
          if (target) {
            const rawText = (target.innerText || target.textContent || "").trim();
            if (rawText.length > 30) {
              const clone = target.cloneNode(true);
              cleanElement(clone);
              const cleanText = (clone.innerText || clone.textContent || "").trim();
              if (cleanText.length > 20) {
                return {
                  html: clone.innerHTML,
                  text: cleanText
                };
              }
            }
          }
        } catch (_) {}
      }

      try {
        const candidates = Array.from(document.querySelectorAll("div, section, article"));
        let bestEl = null;
        let maxScore = 0;
        for (const el of candidates) {
          if (el.closest("nav, header, footer, aside, .sidebar, .comments")) continue;
          const text = (el.innerText || "").trim();
          if (text.length < 50) continue;
          const pCount = el.querySelectorAll("p").length;
          const score = text.length + pCount * 100;
          if (score > maxScore) {
            maxScore = score;
            bestEl = el;
          }
        }
        if (bestEl && maxScore > 200) {
          const clone = bestEl.cloneNode(true);
          cleanElement(clone);
          return {
            html: clone.innerHTML,
            text: (clone.innerText || clone.textContent || "").trim()
          };
        }
      } catch (_) {}

      const body = document.body || document.documentElement;
      if (body) {
        const clone = body.cloneNode(true);
        cleanElement(clone);
        return {
          html: clone.innerHTML,
          text: (clone.innerText || clone.textContent || "").trim()
        };
      }

      return { html: "", text: "" };
    }

    const article = extractArticle();

    const getMeta = (names) => {
      for (const name of names) {
        try {
          const el = document.querySelector("meta[name=\x27" + name + "\x27], meta[property=\x27" + name + "\x27]");
          if (el) {
            const val = el.getAttribute("content");
            if (val) return val.trim();
          }
        } catch (_) {}
      }
      return "";
    };

    const faviconEl = document.querySelector("link[rel*=\x27icon\x27]");
    const title = document.title || "未命名网页";
    const url = window.location.href || "";
    const description = getMeta(["description", "og:description", "twitter:description"]);
    const author = getMeta(["author", "article:author", "twitter:creator"]);
    const siteName = getMeta(["og:site_name", "application-name"]) || window.location.hostname || "";
    const favicon = faviconEl ? faviconEl.href : (window.location.origin + "/favicon.ico");

    return {
      title: title,
      url: url,
      description: description,
      author: author,
      siteName: siteName,
      favicon: favicon,
      selectedText: selectedText,
      selectedHtml: selectedHtml,
      articleHtml: article.html,
      articleText: article.text,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      title: document.title || "未命名网页",
      url: window.location.href,
      selectedText: "",
      selectedHtml: "",
      articleHtml: document.body ? document.body.innerText : "",
      articleText: document.body ? document.body.innerText : "",
      timestamp: new Date().toISOString()
    };
  }
})()`
export type Tab = { ready?: boolean; openerId?: string; favicon?: string; id: string; url: string; title: string; loading: boolean; back: boolean; forward: boolean; error: string; zoom: number; pinned?: boolean }

/** Performs the new tab operation. */
export const newTab = (): Tab => ({ id: crypto.randomUUID(), url: "", title: "新标签页", loading: false, back: false, forward: false, error: "", zoom: 1 })
export type BookmarkItem = { title: string; url: string; favicon?: string }
export const BROWSER_TABS_KEY = "browser-tabs"
export const BROWSER_ACTIVE_TAB_KEY = "browser-active-tab"
export type SavedBrowserTab = {
  id: string
  url: string
  title: string
  favicon?: string
  pinned?: boolean
  openerId?: string
  zoom?: number
}

/** Loads saved browser tabs. */
export function loadSavedBrowserTabs(): { tabs: Tab[]; activeId: string } {
  try {
    const raw = localStorage.getItem(BROWSER_TABS_KEY)
    const savedActiveId = localStorage.getItem(BROWSER_ACTIVE_TAB_KEY) || ""
    if (raw) {
      const parsed = JSON.parse(raw) as SavedBrowserTab[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        const restored: Tab[] = parsed
          .filter((item): item is SavedBrowserTab => Boolean(item && typeof item.id === "string" && typeof item.url === "string"))
          .map((item) => ({
            id: item.id,
            url: item.url,
            title: item.title || (item.url ? "正在加载…" : "新标签页"),
            favicon: item.favicon,
            pinned: Boolean(item.pinned),
            openerId: item.openerId,
            loading: Boolean(item.url),
            ready: false,
            back: false,
            forward: false,
            error: "",
            zoom: typeof item.zoom === "number" ? item.zoom : 1
          }))
        if (restored.length > 0) {
          const activeId = restored.some((t) => t.id === savedActiveId) ? savedActiveId : restored[0].id
          return { tabs: restored, activeId }
        }
      }
    }
  } catch (error) {
    console.error("Failed to restore browser tabs:", error)
  }
  const defaultTab = newTab()
  return { tabs: [defaultTab], activeId: defaultTab.id }
}
export const shortcuts: BookmarkItem[] = [
  { title: "GitHub", url: "https://github.com", favicon: "https://github.githubassets.com/favicons/favicon.svg" },
  { title: "StackOverflow", url: "https://stackoverflow.com", favicon: "https://stackoverflow.com/favicon.ico" },
  { title: "MDN Docs", url: "https://developer.mozilla.org", favicon: "https://developer.mozilla.org/favicon-48x48.png" },
  { title: "React", url: "https://react.dev", favicon: "https://react.dev/favicon.ico" },
  { title: "稀土掘金", url: "https://juejin.cn", favicon: "https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/static/favicons/favicon-32x32.png" }
]
