"use client"

import { useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { useTranslations } from "next-intl"
import { UsersIcon, UserIcon, ParkingCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { GuestListContent } from "@/components/floorplan/guest-panel"
import { cn } from "@/lib/utils"
import type { Person, Group } from "@/lib/types"

interface MobileGuestSheetProps {
  persons: Person[]
  groups: Group[]
  selectedPersonId: string | null
  onSelectPerson: (personId: string | null) => void
  selectedTableLabel?: string | null
  onUnseat: (personId: string) => void
}

export function MobileGuestSheet({
  persons,
  groups,
  selectedPersonId,
  onSelectPerson,
  selectedTableLabel,
  onUnseat,
}: MobileGuestSheetProps) {
  const t = useTranslations("floorplan.guests")
  const tp = useTranslations("floorplan.parking")
  const [open, setOpen] = useState(false)

  const unassigned = persons.filter((p) => !p.table_ref || !p.seat_ref)
  const parked = unassigned
  const { setNodeRef, isOver } = useDroppable({ id: "parking-area" })

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        className="fixed bottom-4 right-4 z-30 flex min-h-12 items-center gap-1.5 rounded-full bg-background px-3 py-2 shadow-lg ring-1 ring-border"
        onClick={() => setOpen(true)}
      >
        <UsersIcon className="size-4 text-muted-foreground" />
        <Badge variant="outline" className="text-[10px] px-1">
          {unassigned.length}
        </Badge>
      </button>

      {/* Bottom sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>
              {t("title")}{" "}
              <span className="text-muted-foreground font-normal">
                ({t("count", { unassigned: unassigned.length, total: persons.length })})
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col overflow-hidden">
            <GuestListContent
              persons={persons}
              groups={groups}
              selectedPersonId={selectedPersonId}
              onSelectPerson={onSelectPerson}
              selectedTableLabel={selectedTableLabel}
              draggable={false}
              onPersonTap={() => setOpen(false)}
            />

            {/* Divider */}
            <div className="mx-2 h-px bg-border" />

            {/* Parked persons section */}
            <div
              ref={setNodeRef}
              className={cn(
                "p-2 space-y-1",
                isOver && "bg-primary/5"
              )}
            >
              <div className="flex items-center gap-1.5 px-1 pb-1">
                <ParkingCircleIcon className="size-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">
                  {tp("notPlaced", { count: parked.length })}
                </span>
              </div>
              {parked.length === 0 ? (
                <p className="py-2 text-center text-[10px] text-muted-foreground">
                  {tp("allPlaced")}
                </p>
              ) : (
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {parked.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-2 rounded-md px-2 py-2 min-h-11 text-sm"
                    >
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted">
                        <UserIcon className="size-2.5" />
                      </div>
                      <span className="truncate text-xs">{person.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
