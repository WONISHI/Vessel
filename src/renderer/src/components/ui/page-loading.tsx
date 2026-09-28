import artwork from "@/assets/vessel-loading/page-loading.svg"
import { cn } from "@/lib/utils"
export function PageLoading({ label = "正在加载页面…", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex h-full min-h-40 flex-col items-center justify-center gap-3 bg-white", className)}
    >
      <img
        src={artwork}
        alt=""
        className="h-36 w-48"
      />
      <span className="text-xs text-stone-400">{label}</span>
    </div>
  )
}
