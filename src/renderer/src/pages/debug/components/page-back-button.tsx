import { Button } from "@/components/ui/button"
import { useRouter } from "@vessel/react-router"
import { ArrowLeft } from "lucide-react"

/** Renders the page back button component. */
export function PageBackButton() {
  const router = useRouter()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-[#9aa1a9] dark:hover:bg-[#30353c] dark:hover:text-white"
      aria-label="返回上一页"
      data-title="返回上一页"
      onClick={() => void router.back()}
    >
      <ArrowLeft aria-hidden="true" />
    </Button>
  )
}
