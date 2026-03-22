"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  CalendarDaysIcon,
  SettingsIcon,
  LogOutIcon,
  ChevronsUpDownIcon,
  UserIcon,
} from "lucide-react"
import { Logo, LogoIcon } from "@/components/logo"
import { useSession, signOut } from "@/lib/auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navItems = [
  {
    titleKey: "events" as const,
    href: "/events",
    icon: CalendarDaysIcon,
  },
  {
    titleKey: "admin" as const,
    href: "/admin",
    icon: SettingsIcon,
    requiredRole: "admin",
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { state } = useSidebar()
  const { data: session } = useSession()
  const t = useTranslations("nav")

  const user = session?.user
  const role = (user as { role?: string } | undefined)?.role

  const visibleItems = navItems.filter(
    (item) => !item.requiredRole || role === item.requiredRole
  )

  async function handleSignOut() {
    const { clearTokenCache } = await import("@/lib/api")
    clearTokenCache()
    await signOut()
    router.replace("/login")
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/events" className="flex items-center group-data-[collapsible=icon]:justify-center">
          <LogoIcon className="size-8 hidden group-data-[collapsible=icon]:block" />
          <Logo variant="dark" className="h-14 group-data-[collapsible=icon]:hidden" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive = pathname.startsWith(item.href)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={t(item.titleKey)}
                      render={<Link href={item.href} />}
                      className="text-sm py-2"
                    >
                      <item.icon className="!size-5" />
                      <span>{t(item.titleKey)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="w-full"
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={t("userMenu")}
                  />
                }
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted">
                  <UserIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {user?.name ?? t("user")}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email ?? ""}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={state === "collapsed" ? "right" : "top"}
                align="start"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
              >
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <UserIcon />
                  <span>{t("profile")}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOutIcon />
                  <span>{t("signOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
