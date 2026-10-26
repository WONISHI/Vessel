/** Tasks remain Markdown text so table JSON stays portable and editable. */
export function parseTableTask(line: string) {
  const match = line.match(/^\s*[-*+]\s*\[([ xX])\](?:[ \t]+|$)(.*)$/)
  return match ? { checked: match[1].toLowerCase() === "x", text: match[2] } : null
}

export function isTableTaskList(text: string) {
  return text.split("\n").every((line) => Boolean(parseTableTask(line)))
}

export function setTableTaskList(text: string, enabled: boolean) {
  return text
    .split("\n")
    .map((line) => {
      const task = parseTableTask(line)
      return enabled ? (task ? line : `- [ ] ${line}`) : task ? task.text : line
    })
    .join("\n")
}

export function checkTableTask(text: string, index: number, checked: boolean) {
  return text
    .split("\n")
    .map((line, i) => {
      const task = i === index ? parseTableTask(line) : null
      return task ? `- [${checked ? "x" : " "}] ${task.text}` : line
    })
    .join("\n")
}
