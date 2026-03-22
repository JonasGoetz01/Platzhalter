"use client"

import { useTranslations } from "next-intl"
import { UserIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AssignModeBarProps {
  personName: string
  bookedTable?: string | null
  onCancel: () => void
}

export function AssignModeBar({ personName, bookedTable, onCancel }: AssignModeBarProps) {
  const t = useTranslations("floorplan.guests")

  return (
    <div className="fixed bottom-4 inset-x-4 z-30 md:hidden flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2.5">
      <UserIcon className="size-4 shrink-0" />
      <span className="text-sm font-medium truncate">{personName}</span>
      {bookedTable && (
        <span className="shrink-0 rounded bg-primary-foreground/20 px-1.5 text-[10px]">
          → {bookedTable}
        </span>
      )}
      <span className="text-xs opacity-75 truncate">{t("tapToPlace")}</span>
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-primary-foreground hover:bg-primary-foreground/20"
        onClick={onCancel}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  )
}
