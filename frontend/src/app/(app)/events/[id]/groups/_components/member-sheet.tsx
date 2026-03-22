"use client"

import { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import { SearchIcon, MinusIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import type { Group, Person } from "@/lib/types"

interface MemberSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: Group
  persons: Person[]
  onPersonsChanged: () => void
}

export function MemberSheet({
  open,
  onOpenChange,
  group,
  persons,
  onPersonsChanged,
}: MemberSheetProps) {
  const t = useTranslations("groups")
  const te = useTranslations("errors")
  const [search, setSearch] = useState("")
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const members = useMemo(
    () => persons.filter((p) => p.group_id === group.id),
    [persons, group.id]
  )

  const ungrouped = useMemo(() => {
    const list = persons.filter((p) => !p.group_id)
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((p) => p.name.toLowerCase().includes(q))
  }, [persons, search])

  async function addMember(person: Person) {
    setPendingIds((prev) => new Set(prev).add(person.id))
    try {
      await apiFetch(`/persons/${person.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: person.name,
          group_id: group.id,
          booked_table: person.booked_table,
        }),
      })
      toast.success(t("memberAdded", { name: person.name }))
      onPersonsChanged()
    } catch (err: any) {
      toast.error(err.message ?? te("saveFailed"))
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(person.id)
        return next
      })
    }
  }

  async function removeMember(person: Person) {
    setPendingIds((prev) => new Set(prev).add(person.id))
    try {
      await apiFetch(`/persons/${person.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: person.name,
          group_id: null,
          booked_table: person.booked_table,
        }),
      })
      toast.success(t("memberRemoved", { name: person.name }))
      onPersonsChanged()
    } catch (err: any) {
      toast.error(err.message ?? te("saveFailed"))
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(person.id)
        return next
      })
    }
  }

  async function addAllVisible() {
    const toAdd = ungrouped.filter((p) => !pendingIds.has(p.id))
    if (toAdd.length === 0) return

    for (const p of toAdd) {
      setPendingIds((prev) => new Set(prev).add(p.id))
    }

    const results = await Promise.allSettled(
      toAdd.map((p) =>
        apiFetch(`/persons/${p.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: p.name,
            group_id: group.id,
            booked_table: p.booked_table,
          }),
        })
      )
    )

    const succeeded = results.filter((r) => r.status === "fulfilled").length
    if (succeeded > 0) {
      toast.success(t("membersAdded", { count: succeeded }))
    }
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed > 0) {
      toast.error(te("saveFailed"))
    }

    setPendingIds((prev) => {
      const next = new Set(prev)
      for (const p of toAdd) next.delete(p.id)
      return next
    })
    onPersonsChanged()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="md:side-right md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-[420px] md:max-w-[420px] md:border-l md:border-t-0 max-h-[85dvh] md:max-h-full overflow-hidden flex flex-col"
        showCloseButton={false}
      >
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: group.color }}
            />
            <SheetTitle className="truncate">{group.name}</SheetTitle>
            <span className="text-sm text-muted-foreground shrink-0">
              {t("members", { count: members.length })}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t("done")}
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 min-h-0">
          {/* Search ungrouped */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchUngrouped")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Ungrouped list */}
          {ungrouped.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("addMembers")}
                </span>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={addAllVisible}
                >
                  {t("selectAllVisible")}
                </button>
              </div>
              {ungrouped.map((person) => {
                const isPending = pendingIds.has(person.id)
                return (
                  <button
                    key={person.id}
                    type="button"
                    disabled={isPending}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm active:bg-accent transition-colors disabled:opacity-50"
                    onClick={() => addMember(person)}
                  >
                    <span className="flex-1 truncate">{person.name}</span>
                    {isPending && (
                      <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {ungrouped.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              {search.trim() ? t("noSearchResults") : t("noUngroupedGuests")}
            </p>
          )}

          {/* Current members */}
          {members.length > 0 && (
            <div className="space-y-1">
              <div className="px-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("currentMembers", { count: members.length })}
                </span>
              </div>
              {members.map((person) => {
                const isPending = pendingIds.has(person.id)
                return (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <span className="flex-1 truncate">{person.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={isPending}
                      onClick={() => removeMember(person)}
                    >
                      {isPending ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <MinusIcon className="size-3.5" />
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
