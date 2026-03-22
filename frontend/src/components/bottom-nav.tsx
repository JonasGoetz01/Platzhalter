"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  HomeIcon,
  UsersIcon,
  LayoutGridIcon,
  ClipboardListIcon,
} from "lucide-react"

const tabs = [
  { key: "home" as const, segment: "home", icon: HomeIcon },
  { key: "guests" as const, segment: "guests", icon: UsersIcon },
  { key: "planner" as const, segment: "planner", icon: LayoutGridIcon },
  { key: "summary" as const, segment: "summary", icon: ClipboardListIcon },
]

export function BottomNav() {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const t = useTranslations("nav")

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card safe-area-bottom">
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const href = `/events/${params.id}/${tab.segment}`
          const isActive = pathname.includes(`/${tab.segment}`)

          return (
            <Link
              key={tab.key}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-xs transition-colors min-h-[56px] justify-center ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon
                className={`size-5 ${isActive ? "stroke-[2.5]" : ""}`}
              />
              <span>{t(tab.key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
