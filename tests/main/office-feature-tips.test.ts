import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { expect, it } from "vitest"
import { hideOfficeFeatureTips } from "@main/office/hide-feature-tips"

it("hides feature tours but preserves ordinary notices in every bundled editor", () => {
  for (const editor of ["spreadsheeteditor", "documenteditor", "presentationeditor", "pdfeditor", "visioeditor"]) {
    const original = readFileSync(`resources/office/v9.3.0.24-1/web-apps/apps/${editor}/main/app.js`, "utf8")
    const patched = hideOfficeFeatureTips(original)
    expect(patched).not.toBe(original)
    const predicate = patched.match(/i=function\(e\)\{return t\[e\]&&!t\[e\]\.isNewFeature&&[^}]+\}/)![0].slice(2)
    const available = runInNewContext(`(${predicate})`, { t: { feature: { isNewFeature: true }, error: { text: "save conflict" } }, Common: { localStorage: { getItem: () => null } } })
    expect(available("feature")).toBe(false)
    expect(available("error")).toBe(true)
    expect(hideOfficeFeatureTips(patched)).toBe(patched)
  }
})
