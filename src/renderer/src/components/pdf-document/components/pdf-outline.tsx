import { DocumentOutline } from "@/components/core/canvas/variants/markdown/document-outline"
import { readPageTitles, type PdfHeading } from "./pdf-heading-text"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { useEffect, useRef, useState, type RefObject } from "react"

type Bookmark = Pick<Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>[number], "title" | "dest"> & { items: Bookmark[] }

async function readHeadings(pdf: PDFDocumentProxy, isActive: () => boolean): Promise<PdfHeading[]> {
  const headings: PdfHeading[] = []
  async function visit(items: Bookmark[], level: number) {
    for (const item of items) {
      if (!isActive()) return
      let childLevel = level
      try {
        const destination = typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest
        const target = destination?.[0]
        const index = typeof target === "number" ? target : target ? await pdf.getPageIndex(target) : -1
        if (item.title.trim() && Number.isInteger(index) && index >= 0 && index < pdf.numPages) {
          headings.push({ text: item.title.trim(), level, page: index + 1 })
          childLevel++
        }
      } catch {
        // A broken destination should not hide its valid child bookmarks.
      }
      await visit(item.items, childLevel)
    }
  }
  await visit((await pdf.getOutline()) ?? [], 1)
  return headings
}

async function inferHeadings(pdf: PDFDocumentProxy, isActive: () => boolean): Promise<PdfHeading[]> {
  const titles: Awaited<ReturnType<typeof readPageTitles>> = []
  for (let number = 1; number <= pdf.numPages && isActive(); number++) {
    try {
      titles.push(...await readPageTitles(await pdf.getPage(number), number))
    } catch {
      // Continue scanning when an individual page has unreadable text.
    }
  }
  const marginOccurrences = new Map<string, Set<number>>()
  const inMargin = (offset: number) => offset < .1 || offset > .9
  for (const title of titles) {
    if (!inMargin(title.offset)) continue
    const pages = marginOccurrences.get(title.text) ?? new Set<number>()
    pages.add(title.page)
    marginOccurrences.set(title.text, pages)
  }
  const unique = titles.filter((title) => !inMargin(title.offset) || (marginOccurrences.get(title.text)?.size ?? 0) < 2)
  const sizes = [...new Set(unique.map(({ size }) => Math.round(size * 4) / 4))].sort((a, b) => b - a)
  return unique.map(({ size, ...title }) => ({
    ...title,
    level: Math.min(3, sizes.indexOf(Math.round(size * 4) / 4) + 1)
  }))
}

export function PdfOutline({ pdf, name, viewport }: {
  pdf: PDFDocumentProxy
  name: string
  viewport: RefObject<HTMLDivElement | null>
}) {
  const [headings, setHeadings] = useState<PdfHeading[]>()
  const [activeIndex, setActiveIndex] = useState(-1)
  const selected = useRef<number | undefined>(undefined)
  useEffect(() => {
    let active = true
    void (async () => {
      const bookmarks = await readHeadings(pdf, () => active).catch(() => [])
      if (!active) return
      const items = bookmarks.length ? bookmarks : await inferHeadings(pdf, () => active)
      if (active) setHeadings(items)
    })()
    return () => { active = false }
  }, [pdf])

  useEffect(() => {
    const root = viewport.current
    if (!root || !headings?.length) return
    const pages = Array.from(root.querySelectorAll("[data-pdf-page]"))
    let frame = 0
    const updatePage = () => {
      const readingLine = root.getBoundingClientRect().top + Math.min(48, root.clientHeight / 2)
      let first = 0
      let last = pages.length - 1
      while (first < last) {
        const middle = Math.floor((first + last) / 2)
        if (pages[middle].getBoundingClientRect().bottom > readingLine) last = middle
        else first = middle + 1
      }
      const bounds = pages[first]?.getBoundingClientRect()
      if (!bounds) return
      const offset = Math.max(0, (readingLine - bounds.top) / Math.max(1, bounds.height))
      const page = first + 1
      let index = -1
      headings.forEach((heading, candidate) => {
        if (heading.page > page || (heading.page === page && (heading.offset ?? 0) > offset)) return
        const current = headings[index]
        if (!current || heading.page > current.page ||
            (heading.page === current.page && (heading.offset ?? 0) > (current.offset ?? 0))) index = candidate
      })
      const bookmark = selected.current
      if (bookmark !== undefined && headings[bookmark]?.offset === undefined && headings[bookmark]?.page === page) index = bookmark
      setActiveIndex(index)
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updatePage)
    }
    root.addEventListener("scroll", onScroll, { passive: true })
    updatePage()
    return () => {
      root.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [headings, viewport])

  return <DocumentOutline
    kind="pdf"
    documentPath={name}
    fileName={name}
    headings={headings ?? []}
    emptyMessage={headings ? "未识别到章节标题" : "正在读取 PDF 目录…"}
    activeIndex={activeIndex}
    onSelect={(index) => {
      const root = viewport.current
      const heading = headings?.[index]
      if (!heading) return
      const target = root?.querySelector(`[data-pdf-page="${heading.page}"]`)
      if (!root || !target) return
      const bounds = target.getBoundingClientRect()
      const offset = heading.offset ?? 0
      root.scrollTop += bounds.top + bounds.height * offset - root.getBoundingClientRect().top - root.clientTop
      selected.current = index
      setActiveIndex(index)
    }}
  />
}
