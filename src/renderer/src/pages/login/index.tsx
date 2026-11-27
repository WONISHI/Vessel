import { useSearchParams } from 'react-router-dom'
import { useRouter } from '@vessel/react-router'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DatabaseSyncSettings } from '@/pages/settings/components/database-sync-settings'
import '@/pages/settings/settings.css'

export default function LoginPage() {
  const router = useRouter()
  const [params] = useSearchParams()
  return <ScrollArea className="vessel-settings h-dvh w-full bg-background text-foreground">
    <main style={{ minHeight: "calc(100dvh - var(--app-titlebar-height, 0px))" }} className="mx-auto flex w-full max-w-5xl flex-col justify-center p-6 md:p-12">
      <DatabaseSyncSettings standaloneLogin initialMode={params.get("mode") === "register" ? "register" : "login"} onAddUserDomain={() => { void router.push("/login/user-domain") }} onAuthenticated={() => { void router.replace("/") }} />
    </main>
  </ScrollArea>
}
