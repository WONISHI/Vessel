import { BrowserFavicon } from "@/components/browser-favicon"
import { ArrowRight, Leaf, Snowflake } from "lucide-react"
import type { Tab } from "@/pages/browser/components/index-shared"

export function BrowserFrozenPage({ tab, onResume }: { tab: Tab; onResume: () => void }) {
  let address = tab.url
  try { address = new URL(tab.url).host || tab.url } catch { /* Keep local addresses readable. */ }

  return <div className="browser-frozen-page">
    <section className="browser-frozen-card" aria-labelledby="browser-frozen-title">
      <div className="browser-frozen-emblem" aria-hidden="true">
        <svg className="browser-frozen-orbit" viewBox="0 0 88 88" fill="none"><circle cx="44" cy="44" r="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 7" strokeLinecap="round" /></svg>
        <Snowflake size={30} strokeWidth={1.5} />
      </div>
      <span className="browser-frozen-status"><Leaf size={12} />节省内存中</span>
      <h2 id="browser-frozen-title">标签页已冻结</h2>
      <p className="browser-frozen-description">暂时放下，也能随时继续。<br />页面内存已释放，标签仍为你保留。</p>
      <div className="browser-frozen-site">
        <span className="browser-frozen-site-icon"><BrowserFavicon url={tab.url} favicon={tab.favicon} /></span>
        <div className="browser-frozen-site-copy"><strong>{tab.title || "未命名页面"}</strong><span>{address}</span></div>
      </div>
      <button type="button" className="browser-frozen-resume" onClick={onResume}>恢复浏览<ArrowRight size={15} /></button>
      <p className="browser-frozen-hint">恢复时将重新加载此页面</p>
    </section>
  </div>
}
