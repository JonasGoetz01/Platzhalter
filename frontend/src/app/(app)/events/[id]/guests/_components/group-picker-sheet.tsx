"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { PlusIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { GROUP_COLORS } from "@/lib/constants"
import type { Group, Person } from "@/lib/types"

interface GroupPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: Group[]
  selectedPersons: Person[]
  eventId: string
  onDone: () => void
}

export function GroupPickerSheet({
  open,
  onOpenChange,
  groups,
  selectedPersons,
  eventId,
  onDone,
}: GroupPickerSheetProps) {
  const t = useTranslations("guests")
  const tg = useTranslations("groups")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const [assigning, setAssigning] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupColor, setNewGroupColor] = useState(
    GROUP_COLORS[groups.length % GROUP_COLORS.length]
  )
  const [creatingGroup, setCreatingGroup] = useState(false)

  async function assignToGroup(groupId: string | null, groupName?: string) {
    setAssigning(true)
    const results = await Promise.allSettled(
      selectedPersons.map((p) =>
        apiFetch(`/persons/${p.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: p.name,
            group_id: groupId,
            booked_table: p.booked_table,
          }),
        })
      )
    )

    const succeeded = results.filter((r) => r.status === "fulfilled").length
    if (groupId && groupName && succeeded > 0) {
      toast.success(t("groupAssigned", { group: groupName }))
    } else if (!groupId && succeeded > 0) {
      toast.success(t("groupRemoved"))
    }

    const failed = results.filter((r) => r.status === "rejected").length
    if (failed > 0) {
      toast.error(te("saveFailed"))
    }

    setAssigning(false)
    onOpenChange(false)
    onDone()
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!newGroupName.trim()) return
    setCreatingGroup(true)

    try {
      const created = await apiFetch<Group>(`/events/${eventId}/groups`, {
        method: "POST",
        body: JSON.stringify({
          name: newGroupName.trim(),
          color: newGroupColor,
        }),
      })
      setShowNewGroup(false)
      setNewGroupName("")
      await assignToGroup(created.id, created.name)
    } catch (err: any) {
      toast.error(err.message ?? te("createFailed"))
    } finally {
      setCreatingGroup(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[70dvh] overflow-hidden flex flex-col"
        showCloseButton={false}
      >
        <SheetHeader className="border-b pb-3">
          <SheetTitle>{t("assignGroup")}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-1 min-h-0">
          {/* No group option */}
          <button
            type="button"
            disabled={assigning}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm active:bg-accent transition-colors disabled:opacity-50"
            onClick={() => assignToGroup(null)}
          >
            <div className="size-3 rounded-full border border-dashed border-muted-foreground" />
            <span>{t("noGroup")}</span>
            {assigning && (
              <Loader2Icon className="ml-auto size-4 animate-spin text-muted-foreground" />
            )}
          </button>

          {/* Existing groups */}
          {groups.map((group) => {
            const count = selectedPersons.filter(
              (p) => p.group_id === group.id
            ).length
            return (
              <button
                key={group.id}
                type="button"
                disabled={assigning}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm active:bg-accent transition-colors disabled:opacity-50"
                onClick={() => assignToGroup(group.id, group.name)}
              >
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <span className="flex-1">{group.name}</span>
                {count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          {/* New group inline form */}
          {showNewGroup ? (
            <form
              onSubmit={handleCreateGroup}
              className="space-y-3 px-4 py-3 border rounded-lg mx-1"
            >
              <div className="space-y-1.5">
                <Label className="text-xs">{tc("name")}</Label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={tg("namePlaceholder")}
                  disabled={creatingGroup}
                  autoFocus
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewGroupColor(color)}
                    className="rounded-full transition-all"
                  >
                    <div
                      className="size-6 rounded-full"
                      style={{
                        backgroundColor: color,
                        boxShadow:
                          newGroupColor === color
                            ? "0 0 0 2px var(--color-foreground)"
                            : "none",
                      }}
                    />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewGroup(false)}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creatingGroup || !newGroupName.trim()}
                >
                  {creatingGroup && <Loader2Icon className="animate-spin" />}
                  {tc("create")}
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              disabled={assigning}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-primary active:bg-accent transition-colors disabled:opacity-50"
              onClick={() => setShowNewGroup(true)}
            >
              <PlusIcon className="size-3" />
              <span>{tg("newGroup")}</span>
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
