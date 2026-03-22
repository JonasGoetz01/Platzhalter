"use client"

import { useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import { useTranslations } from "next-intl"
import {
  ParkingCircleIcon,
  UserIcon,
  GripVerticalIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import type { Person } from "@/lib/types"

interface ParkingAreaProps {
  persons: Person[]
  onUnseat: (personId: string) => void
  draggable?: boolean
}

export function ParkingArea({
  persons,
  onUnseat,
  draggable = false,
}: ParkingAreaProps) {
  const t = useTranslations("floorplan.parking")
  const isMobile = useIsMobile()
  const [mobileOpen, setMobileOpen] = useState(false)

  const parked = persons.filter((p) => !p.table_ref || !p.seat_ref)
  const { setNodeRef, isOver } = useDroppable({ id: "parking-area" })

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          className="fixed bottom-4 left-4 z-30 flex min-h-11 min-w-11 items-center gap-1.5 rounded-full bg-background px-3 py-2 shadow-lg ring-1 ring-border"
          onClick={() => setMobileOpen(true)}
        >
          <ParkingCircleIcon className="size-4 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px] px-1">
            {parked.length}
          </Badge>
        </button>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="bottom" className="max-h-[60vh]">
            <SheetHeader>
              <SheetTitle>
                {t("notPlaced", { count: parked.length })}
              </SheetTitle>
            </SheetHeader>
            <div
              ref={setNodeRef}
              className={cn(
                "flex-1 overflow-y-auto p-2 space-y-1",
                isOver && "bg-primary/5"
              )}
            >
              {parked.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {t("allPlaced")}
                </p>
              ) : (
                parked.map((person) => (
                  <ParkedPersonItem
                    key={person.id}
                    person={person}
                    draggable={draggable}
                  />
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <div className="border-t">
      <div
        ref={setNodeRef}
        className={cn(
          "p-2 transition-colors",
          isOver && "bg-primary/5 ring-1 ring-inset ring-primary/20"
        )}
      >
        <div className="flex items-center gap-1.5 px-1 pb-1">
          <ParkingCircleIcon className="size-3 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">
            {t("title")}
          </span>
          <Badge variant="outline" className="text-[9px] px-1 py-0">
            {parked.length}
          </Badge>
        </div>
        {parked.length === 0 ? (
          <p className="py-2 text-center text-[10px] text-muted-foreground">
            {t("dragToRemove")}
          </p>
        ) : (
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {parked.map((person) => (
              <ParkedPersonItem
                key={person.id}
                person={person}
                draggable={draggable}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ParkedPersonItem({
  person,
  draggable: isDraggable,
}: {
  person: Person
  draggable?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `parked-${person.id}`,
    data: { type: "person", personId: person.id, name: person.name },
    disabled: !isDraggable,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-2 min-h-11 text-sm transition-colors active:bg-accent",
        isDragging && "opacity-50"
      )}
    >
      {isDraggable && (
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground active:cursor-grabbing shrink-0"
        >
          <GripVerticalIcon className="size-4" />
        </span>
      )}
      <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted">
        <UserIcon className="size-2.5" />
      </div>
      <span className="truncate text-xs">{person.name}</span>
    </div>
  )
}
