import WorkspacePage from "@/components/workspace/index"

/** Renders the external editor component. */
export function ExternalEditor({ path }: { path: string }) {
  const name = path.split(/[\\/]/).pop() || path
  const parent = path.slice(0, path.length - name.length)
  const root = /^[A-Za-z]:[\\/]$/.test(parent) ? parent : parent.replace(/[\\/]$/, "") || "/"
  const workspace = { name: root.split(/[\\/]/).pop() || root, path: root, files: [{ name, path }] }
  return (
    <WorkspacePage
      workspace={workspace}
      initialFile={path}
    />
  )
}
