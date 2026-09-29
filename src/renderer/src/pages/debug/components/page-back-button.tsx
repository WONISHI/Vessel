import { ArrowLeft } from "lucide-react"
import { useRouter } from "@vessel/react-router"
import { Button } from "@/components/ui/button"

export function PageBackButton() {
  const router = useRouter()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
      aria-label="返回上一页"
      title="返回上一页"
      onClick={() => void router.back()}
    >
      <ArrowLeft aria-hidden="true" />
    </Button>
  )
}
