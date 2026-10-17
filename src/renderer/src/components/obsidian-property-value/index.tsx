import { ReadOnlyDatePopover } from "@/components/read-only-date-popover"
import { parseCalendarDate } from "@vessel/utils"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
import { parseObsidianLinks } from "@vessel/obsidian"
import { useContext, useState } from "react"

/** Renders parsed property links and opens resolved wiki targets inside the current workspace. */
export function ObsidianPropertyValue({ text, root }: { text: string; root: string }) {
  const context = useContext(WorkspaceContext)
  const [error, setError] = useState("")

  /** Uses the existing vault resolver for short note names, aliases and root-relative wiki paths. */
  const openWikiLink = async (target: string) => {
    setError("")
    try {
      const file = await window.electronAPI.readWikiLink(root, target)
      context?.openWorkspaceFile({ name: file.path.split(/[\\/]/).pop() || target, path: file.path, type: "file" })
    } catch (reason) {
      setError(String(reason))
    }
  }

  /** Opens external links through Electron's controlled HTTP(S) handler. */
  const openUrl = async (target: string) => {
    setError("")
    try {
      await window.electronAPI.openExternal(target)
    } catch (reason) {
      setError(String(reason))
    }
  }

  const date = parseCalendarDate(text)
  if (date)
    return (
      <ReadOnlyDatePopover
        date={date}
        label={`查看日期 ${text}`}
        className="rounded hover:bg-stone-100"
      >
        {text}
      </ReadOnlyDatePopover>
    )

  return (
    <>
      {parseObsidianLinks(text).map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.text}</span>
        ) : (
          <a
            key={index}
            href={part.kind === "url" ? part.target : "#"}
            data-wiki-target={part.kind === "wiki" ? part.target : undefined}
            data-wiki-label={part.kind === "wiki" ? part.text : undefined}
            title={part.kind === "url" ? part.target : undefined}
            className="text-green-700 hover:underline"
            onClick={(event) => {
              event.preventDefault()
              if (part.kind === "wiki") void openWikiLink(part.target!)
              else void openUrl(part.target!)
            }}
          >
            {part.text}
          </a>
        )
      )}
      {error && (
        <span
          role="alert"
          className="ml-2 text-red-600"
        >
          {error}
        </span>
      )}
    </>
  )
}
