"use client"

import { useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { useTranslations } from "next-intl"
import {
  SearchIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TicketIcon,
  GripVerticalIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Person, Group } from "@/lib/types"

/* ── GuestListContent ─────────────────────────────────────── */

interface GuestListContentProps {
  persons: Person[]
  groups: Group[]
  selectedPersonId: string | null
  onSelectPerson: (personId: string | null) => void
  selectedTableLabel?: string | null
  draggable?: boolean
  onPersonTap?: () => void
  children?: React.ReactNode
}

export function GuestListContent({
  persons,
  groups,
  selectedPersonId,
  onSelectPerson,
  selectedTableLabel,
  draggable = false,
  onPersonTap,
  children,
}: GuestListContentProps) {
  const t = useTranslations("floorplan.guests")
  const [search, setSearch] = useState("")

  const unassigned = persons.filter((p) => !p.table_ref || !p.seat_ref)
  const assigned = persons.filter((p) => p.table_ref && p.seat_ref)
  const groupMap = new Map(groups.map((g) => [g.id, g]))

  const filtered = unassigned.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleSelectPerson(personId: string) {
    const newValue = personId === selectedPersonId ? null : personId
    onSelectPerson(newValue)
    if (newValue) onPersonTap?.()
  }

  return (
    <>
      <div className="p-2">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-11 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {selectedTableLabel &&
          (() => {
            const booked = persons.filter(
              (p) =>
                p.booked_table === selectedTableLabel &&
                (!p.table_ref || !p.seat_ref)
            )
            if (booked.length === 0) return null
            return (
              <div className="mb-2">
                <div className="flex items-center gap-1 px-1 py-1">
                  <TicketIcon className="size-3 text-primary" />
                  <span className="text-[10px] font-medium text-primary">
                    {t("booked", { table: selectedTableLabel, count: booked.length })}
                  </span>
                </div>
                <div className="space-y-1">
                  {booked.map((person) => (
                    <PersonItem
                      key={person.id}
                      person={person}
                      group={
                        person.group_id
                          ? groupMap.get(person.group_id) ?? null
                          : null
                      }
                      isSelected={person.id === selectedPersonId}
                      onSelect={() => handleSelectPerson(person.id)}
                      draggable={draggable}
                      icon={<TicketIcon className="size-3 text-primary" />}
                      highlight
                    />
                  ))}
                </div>
                <div className="my-2 h-px bg-border" />
              </div>
            )
          })()}

        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {unassigned.length === 0 ? t("allPlaced") : t("noResults")}
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map((person) => (
              <PersonItem
                key={person.id}
                person={person}
                group={
                  person.group_id
                    ? groupMap.get(person.group_id) ?? null
                    : null
                }
                isSelected={person.id === selectedPersonId}
                onSelect={() => handleSelectPerson(person.id)}
                draggable={draggable}
              />
            ))}
          </div>
        )}
      </div>

      {assigned.length > 0 && (
        <div className="border-t px-3 py-2">
          <p className="text-[10px] text-muted-foreground">
            {t("placed", { count: assigned.length })}
          </p>
        </div>
      )}

      {children}
    </>
  )
}

/* ── GuestPanel (desktop shell) ───────────────────────────── */

interface GuestPanelProps {
  persons: Person[]
  groups: Group[]
  selectedPersonId: string | null
  onSelectPerson: (personId: string | null) => void
  selectedTableLabel?: string | null
  draggable?: boolean
  children?: React.ReactNode
}

export function GuestPanel({
  persons,
  groups,
  selectedPersonId,
  onSelectPerson,
  selectedTableLabel,
  draggable = false,
  children,
}: GuestPanelProps) {
  const t = useTranslations("floorplan.guests")
  const [collapsed, setCollapsed] = useState(false)

  const unassigned = persons.filter((p) => !p.table_ref || !p.seat_ref)

  if (collapsed) {
    return (
      <div className="flex w-12 flex-col items-center border-l bg-background py-2">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          onClick={() => setCollapsed(false)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <div className="mt-2 flex flex-col items-center gap-1">
          <Badge variant="outline" className="text-[10px] px-1">
            {unassigned.length}
          </Badge>
          <span
            className="text-[10px] text-muted-foreground"
            style={{ writingMode: "vertical-lr" }}
          >
            {t("notPlaced")}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-72 flex-col border-l bg-background">
      <div className="flex min-h-11 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">
          {t("title")}{" "}
          <span className="text-muted-foreground">
            ({t("count", { unassigned: unassigned.length, total: persons.length })})
          </span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          onClick={() => setCollapsed(true)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      <GuestListContent
        persons={persons}
        groups={groups}
        selectedPersonId={selectedPersonId}
        onSelectPerson={onSelectPerson}
        selectedTableLabel={selectedTableLabel}
        draggable={draggable}
      >
        {children}
      </GuestListContent>
    </div>
  )
}

/* ── PersonItem ────────────────────────────────────────────── */

function PersonItem({
  person,
  group,
  isSelected,
  onSelect,
  draggable: isDraggable,
  icon,
  highlight,
}: {
  person: Person
  group: Group | null
  isSelected: boolean
  onSelect: () => void
  draggable?: boolean
  icon?: React.ReactNode
  highlight?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `person-${person.id}`,
    data: { type: "person", personId: person.id, name: person.name },
    disabled: !isDraggable,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-2.5 min-h-11 text-left text-sm transition-colors active:bg-accent",
        isSelected && "bg-primary/10 ring-1 ring-primary/30",
        highlight && "ring-1 ring-primary/20 bg-primary/5",
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
      <button
        type="button"
        className="flex flex-1 items-center gap-2 min-h-11 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={onSelect}
      >
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
          {icon ?? <UserIcon className="size-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-xs font-medium">{person.name}</p>
            {person.booked_table && (
              <span className="shrink-0 rounded bg-muted px-1 text-[9px] text-muted-foreground">
                → {person.booked_table}
              </span>
            )}
          </div>
          {group && (
            <p
              className="truncate text-[10px]"
              style={{ color: group.color }}
            >
              {group.name}
            </p>
          )}
        </div>
      </button>
    </div>
  )
}
