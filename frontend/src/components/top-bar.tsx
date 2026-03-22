"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  UserIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { useSession, signOut } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function TopBar() {
  const router = useRouter()
  const { data: session } = useSession()
  const t = useTranslations("nav")

  const user = session?.user
  const role = (user as { role?: string } | undefined)?.role

  async function handleSignOut() {
    const { clearTokenCache } = await import("@/lib/api")
    clearTokenCache()
    await signOut()
    router.replace("/login")
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <Link href="/events" className="flex items-center">
        <Logo variant="light" className="h-8" />
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="rounded-full" />
          }
        >
          <UserIcon className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {user && (
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            <UserIcon />
            <span>{t("profile")}</span>
          </DropdownMenuItem>
          {role === "admin" && (
            <DropdownMenuItem onClick={() => router.push("/admin")}>
              <SettingsIcon />
              <span>{t("admin")}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOutIcon />
            <span>{t("signOut")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
