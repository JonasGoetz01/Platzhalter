"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  ArrowLeftIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  MergeIcon,
  UserIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { GROUP_COLORS } from "@/lib/constants"
import { MemberSheet } from "./_components/member-sheet"
import type { Group, Person } from "@/lib/types"

export default function GroupsPage() {
  const t = useTranslations("groups")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const params = useParams<{ id: string }>()
  const [groups, setGroups] = useState<Group[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<Group | null>(null)
  const [saving, setSaving] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSource, setMergeSource] = useState<string>("")
  const [mergeTarget, setMergeTarget] = useState<string>("")
  const [memberSheetGroup, setMemberSheetGroup] = useState<Group | null>(null)

  const fetchData = useCallback(() => {
    Promise.all([
      apiFetch<Group[]>(`/events/${params.id}/groups`),
      apiFetch<Person[]>(`/events/${params.id}/persons`),
    ])
      .then(([g, p]) => {
        setGroups(g ?? [])
        setPersons(p ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function getMemberCount(groupId: string) {
    return persons.filter((p) => p.group_id === groupId).length
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = new FormData(e.currentTarget)
    const body = {
      name: form.get("name"),
      color: form.get("color"),
    }

    try {
      if (editGroup) {
        const updated = await apiFetch<Group>(`/groups/${editGroup.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
        setGroups((prev) =>
          prev.map((g) => (g.id === updated.id ? updated : g))
        )
        toast.success(t("groupUpdated"))
      } else {
        const created = await apiFetch<Group>(
          `/events/${params.id}/groups`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        )
        setGroups((prev) => [...prev, created])
        toast.success(t("groupCreated"))
        setDialogOpen(false)
        setEditGroup(null)
        setMemberSheetGroup(created)
        return
      }
      setDialogOpen(false)
      setEditGroup(null)
    } catch (err: any) {
      toast.error(err.message ?? te("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(groupId: string) {
    try {
      await apiFetch(`/groups/${groupId}`, { method: "DELETE" })
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
      toast.success(t("groupDeleted"))
    } catch (err: any) {
      toast.error(err.message ?? te("deleteFailed"))
    }
  }

  async function handleMerge() {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return

    try {
      await apiFetch("/groups/merge", {
        method: "POST",
        body: JSON.stringify({
          source_id: mergeSource,
          target_id: mergeTarget,
        }),
      })
      setMergeOpen(false)
      toast.success(t("merged"))
      fetchData()
    } catch (err: any) {
      toast.error(err.message ?? te("mergeFailed"))
    }
  }

  function openEdit(group: Group) {
    setEditGroup(group)
    setDialogOpen(true)
  }

  function openCreate() {
    setEditGroup(null)
    setDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href={`/events/${params.id}`} />}
        >
          <ArrowLeftIcon />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          {groups.length >= 2 && (
            <Button
              variant="outline"
              onClick={() => setMergeOpen(true)}
            >
              <MergeIcon />
              {t("merge")}
            </Button>
          )}
          <Button onClick={openCreate}>
            <PlusIcon />
            {t("newGroup")}
          </Button>
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const memberCount = getMemberCount(group.id)
            const members = persons.filter((p) => p.group_id === group.id)

            return (
              <Card
                key={group.id}
                className="cursor-pointer transition-colors hover:bg-accent/50 active:bg-accent"
                onClick={() => setMemberSheetGroup(group)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="font-medium">{group.name}</span>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => openEdit(group)}
                      >
                        <PencilIcon className="size-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive"
                            />
                          }
                        >
                          <Trash2Icon className="size-3" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("deleteGroup")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("deleteGroupDescription", { name: group.name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(group.id)}
                            >
                              {tc("delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Badge variant="secondary">
                      <UserIcon className="mr-1 size-3" />
                      {t("members", { count: memberCount })}
                    </Badge>
                  </div>
                  {members.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {members.slice(0, 5).map((p) => (
                        <p
                          key={p.id}
                          className="text-xs text-muted-foreground truncate"
                        >
                          {p.name}
                        </p>
                      ))}
                      {members.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          {t("more", { count: members.length - 5 })}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-muted-foreground">{t("noGroups")}</p>
          <Button onClick={openCreate}>
            <PlusIcon />
            {t("createFirstGroup")}
          </Button>
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editGroup ? t("editGroup") : t("newGroupTitle")}
            </DialogTitle>
            <DialogDescription>
              {editGroup ? t("editGroupDescription") : t("newGroupDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">{tc("name")}</Label>
              <Input
                id="group-name"
                name="name"
                defaultValue={editGroup?.name}
                placeholder={t("namePlaceholder")}
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("color")}</Label>
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map((color) => (
                  <label key={color} className="cursor-pointer">
                    <input
                      type="radio"
                      name="color"
                      value={color}
                      defaultChecked={
                        editGroup
                          ? editGroup.color === color
                          : color === GROUP_COLORS[groups.length % GROUP_COLORS.length]
                      }
                      className="sr-only peer"
                    />
                    <div
                      className="size-8 rounded-full ring-2 ring-transparent peer-checked:ring-foreground transition-all"
                      style={{ backgroundColor: color }}
                    />
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="animate-spin" />}
                {editGroup ? tc("save") : tc("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Member management sheet */}
      {memberSheetGroup && (
        <MemberSheet
          open={!!memberSheetGroup}
          onOpenChange={(open) => {
            if (!open) setMemberSheetGroup(null)
          }}
          group={memberSheetGroup}
          persons={persons}
          onPersonsChanged={fetchData}
        />
      )}

      {/* Merge dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mergeTitle")}</DialogTitle>
            <DialogDescription>
              {t("mergeDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("sourceGroup")}</Label>
              <Select value={mergeSource} onValueChange={(v) => { if (v) { setMergeSource(v); if (v === mergeTarget) setMergeTarget("") } }}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectGroup")} />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="size-2 rounded-full"
                          style={{ backgroundColor: g.color }}
                        />
                        {g.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("targetGroup")}</Label>
              <Select value={mergeTarget} onValueChange={(v) => { if (v) setMergeTarget(v) }}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectGroup")} />
                </SelectTrigger>
                <SelectContent>
                  {groups
                    .filter((g) => g.id !== mergeSource)
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2 rounded-full"
                            style={{ backgroundColor: g.color }}
                          />
                          {g.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleMerge}
              disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget}
            >
              {t("merge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
