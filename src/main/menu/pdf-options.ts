import type { PrintToPDFOptions } from "electron"
import type { PdfExportOptions } from "@vessel/type/native-menu"

/** Validate IPC options and generate one consistent page layout for Chromium. */
export function preparePdfExport(html: string, options?: PdfExportOptions): { html: string; print: PrintToPDFOptions } {
  if (!options) return { html, print: { printBackground: true, preferCSSPageSize: true } }
  if (
    !["A4", "A3", "A5", "Letter", "Legal"].includes(options.paper) ||
    typeof options.landscape !== "boolean" ||
    typeof options.printBackground !== "boolean" ||
    typeof options.pageNumbers !== "boolean" ||
    !Number.isFinite(options.marginMm) ||
    options.marginMm < 0 ||
    options.marginMm > 50 ||
    !Number.isFinite(options.fontSize) ||
    options.fontSize < 8 ||
    options.fontSize > 32
  )
    throw new Error("PDF 导出配置无效")
  if (options.pageNumbers && options.marginMm < 10) throw new Error("显示页码时页边距至少为 10 毫米")
  const css = `<style>@page{size:${options.paper} ${options.landscape ? "landscape" : "portrait"};margin:${options.marginMm}mm}body{font-size:${options.fontSize}px;color:#222;background:white}pre{white-space:pre-wrap}img,svg{max-width:100%}thead{display:table-header-group}h1,h2,h3,h4{break-after:avoid}tr,img{break-inside:avoid}</style>`
  const margin = options.marginMm / 25.4
  return {
    html: /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${css}</head>`) : css + html,
    print: {
      pageSize: options.paper,
      landscape: options.landscape,
      printBackground: options.printBackground,
      preferCSSPageSize: true,
      margins: { top: margin, bottom: margin, left: margin, right: margin },
      displayHeaderFooter: options.pageNumbers,
      headerTemplate: "<span></span>",
      footerTemplate: '<div style="width:100%;text-align:center;font-size:9px;color:#888"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    }
  }
}
