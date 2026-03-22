"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { BuildingIcon, ChevronDownIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth"
import { useOrg } from "@/lib/org-context"

interface OrgListItem {
  id: string
  name: string
  slug: string
  logo?: string | null
}

export function OrgSwitcher() {
  const router = useRouter()
  const t = useTranslations("org")
  const { activeOrg } = useOrg()
  const [orgs, setOrgs] = useState<OrgListItem[]>([])

  useEffect(() => {
    authClient.organization.list().then(({ data }) => {
      if (data) {
        setOrgs(data as OrgListItem[])
      }
    })
  }, [activeOrg?.id])

  async function handleSwitch(orgId: string) {
    await authClient.organization.setActive({ organizationId: orgId })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5 max-w-48" />
        }
      >
        <BuildingIcon className="size-4 shrink-0" />
        <span className="truncate">
          {activeOrg?.name ?? t("noOrgs")}
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org.id)}
            className={org.id === activeOrg?.id ? "bg-accent" : ""}
          >
            <BuildingIcon className="size-4" />
            <span className="truncate">{org.name}</span>
          </DropdownMenuItem>
        ))}
        {orgs.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={() => router.push("/organizations/new")}>
          <PlusIcon className="size-4" />
          <span>{t("create")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
