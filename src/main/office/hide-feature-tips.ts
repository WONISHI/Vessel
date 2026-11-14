// ONLYOFFICE 9.3's tip manager uses this predicate for both showing and sequencing tips.
// Mark new-feature tips unavailable so they neither display nor block later real notices.
const predicate = "Common.UI.TooltipManager=new function(){var t={},e={},i=function(e){return t[e]&&!(t[e].name&&Common.localStorage.getItem(t[e].name))}"
export function hideOfficeFeatureTips(source: string): string {
  return source.replace(predicate, predicate.replace("return t[e]&&", "return t[e]&&!t[e].isNewFeature&&"))
}
