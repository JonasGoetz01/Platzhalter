"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  ArrowLeftIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  SearchIcon,
  UserIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  CircleIcon,
  UsersIcon,
  XIcon,
  AlertTriangleIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { GroupPickerSheet } from "./_components/group-picker-sheet"
import type { Person, Group, FloorPlan } from "@/lib/types"

const UNGROUPED_KEY = "__ungrouped__"
const NO_GROUP_VALUE = "__none__"

export default function GuestsPage() {
  const t = useTranslations("guests")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const params = useParams<{ id: string }>()
  const [persons, setPersons] = useState<Person[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editPerson, setEditPerson] = useState<Person | null>(null)
  const [saving, setSaving] = useState(false)
  const [dialogGroupId, setDialogGroupId] = useState<string>(NO_GROUP_VALUE)

  // Grouped view state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [tableLabels, setTableLabels] = useState<Map<string, string>>(new Map())
  const editCounter = useRef(0)

  const fetchData = useCallback(() => {
    Promise.all([
      apiFetch<Person[]>(`/events/${params.id}/persons`),
      apiFetch<Group[]>(`/events/${params.id}/groups`),
      apiFetch<FloorPlan>(`/events/${params.id}/floorplan`).catch(() => null),
    ])
      .then(([p, g, fp]) => {
        setPersons(p ?? [])
        setGroups(g ?? [])
        // Build table UUID → label map from floorplan
        if (fp?.layout?.tables) {
          const map = new Map<string, string>()
          for (const table of fp.layout.tables) {
            map.set(table.id, table.label)
          }
          setTableLabels(map)
        }
        // Initialize expanded groups with all sections
        setExpandedGroups((prev) => {
          if (prev.size === 0) {
            const ids = new Set<string>([UNGROUPED_KEY])
            for (const group of g ?? []) ids.add(group.id)
            return ids
          }
          return prev
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = persons.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // Group persons into sections
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])

  const sections = useMemo(() => {
    const ungrouped = filtered.filter((p) => !p.group_id)
    const grouped = new Map<string, Person[]>()
    for (const p of filtered) {
      if (p.group_id) {
        const list = grouped.get(p.group_id) ?? []
        list.push(p)
        grouped.set(p.group_id, list)
      }
    }

    const result: {
      key: string
      label: string
      color?: string
      persons: Person[]
    }[] = []

    // Ungrouped first
    if (ungrouped.length > 0) {
      result.push({
        key: UNGROUPED_KEY,
        label: t("notGrouped"),
        persons: ungrouped,
      })
    }

    // Then each group
    for (const group of groups) {
      const members = grouped.get(group.id)
      if (members && members.length > 0) {
        result.push({
          key: group.id,
          label: group.name,
          color: group.color,
          persons: members,
        })
      }
    }

    return result
  }, [filtered, groups, t])

  // Flat sorted list for desktop table
  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Ungrouped first
      if (!a.group_id && b.group_id) return -1
      if (a.group_id && !b.group_id) return 1
      // Then by group name
      if (a.group_id && b.group_id && a.group_id !== b.group_id) {
        const ga = groupMap.get(a.group_id)
        const gb = groupMap.get(b.group_id)
        return (ga?.name ?? "").localeCompare(gb?.name ?? "")
      }
      // Then by person name
      return a.name.localeCompare(b.name)
    })
  }, [filtered, groupMap])

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = new FormData(e.currentTarget)
    const bookedRaw = (form.get("booked_table") as string)?.trim() || null
    const groupId = dialogGroupId === NO_GROUP_VALUE ? null : dialogGroupId

    const body = {
      name: form.get("name"),
      booked_table: bookedRaw,
      group_id: groupId,
    }

    try {
      if (editPerson) {
        const updated = await apiFetch<Person>(`/persons/${editPerson.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
        setPersons((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        )
        toast.success(t("guestUpdated"))
      } else {
        const created = await apiFetch<Person>(
          `/events/${params.id}/persons`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        )
        setPersons((prev) => [...prev, created])
        toast.success(t("guestAdded"))
      }
      setDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message ?? te("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(personId: string) {
    try {
      await apiFetch(`/persons/${personId}`, { method: "DELETE" })
      setPersons((prev) => prev.filter((p) => p.id !== personId))
      toast.success(t("guestRemoved"))
    } catch (err: any) {
      toast.error(err.message ?? te("deleteFailed"))
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    const results = await Promise.allSettled(
      ids.map((id) => apiFetch(`/persons/${id}`, { method: "DELETE" }))
    )
    const succeeded = results.filter((r) => r.status === "fulfilled").length
    if (succeeded > 0) {
      toast.success(t("guestsDeleted", { count: succeeded }))
      setPersons((prev) => prev.filter((p) => !selectedIds.has(p.id)))
    }
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed > 0) {
      toast.error(te("deleteFailed"))
    }
    setSelectedIds(new Set())
    setSelectMode(false)
    setBulkDeleting(false)
  }

  function openEdit(person: Person) {
    if (selectMode) return
    editCounter.current++
    setEditPerson(person)
    setDialogGroupId(person.group_id ?? NO_GROUP_VALUE)
    setDialogOpen(true)
  }

  function openCreate() {
    editCounter.current++
    setEditPerson(null)
    setDialogGroupId(NO_GROUP_VALUE)
    setDialogOpen(true)
  }

  function toggleExpanded(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function toggleSelect(personId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(personId)) {
        next.delete(personId)
      } else {
        next.add(personId)
      }
      return next
    })
  }

  function toggleSectionSelect(personIds: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = personIds.every((id) => next.has(id))
      if (allSelected) {
        for (const id of personIds) next.delete(id)
      } else {
        for (const id of personIds) next.add(id)
      }
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const selectedPersons = useMemo(
    () => persons.filter((p) => selectedIds.has(p.id)),
    [persons, selectedIds]
  )

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
            {t("count", { count: persons.length })}
          </p>
        </div>
        <div className="flex gap-2">
          {persons.length > 0 && !selectMode && (
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setSelectMode(true)}
            >
              <CheckCircle2Icon className="size-4" />
            </Button>
          )}
          {persons.length > 0 && !selectMode && (
            <Button
              variant="outline"
              className="hidden md:inline-flex"
              onClick={() => setSelectMode(true)}
            >
              <CheckCircle2Icon className="size-4" />
              {t("select")}
            </Button>
          )}
          {selectMode && (
            <Button variant="ghost" size="icon" onClick={exitSelectMode}>
              <XIcon className="size-4" />
            </Button>
          )}
          {!selectMode && (
            <>
              <Button onClick={openCreate} size="icon" className="md:hidden">
                <PlusIcon />
              </Button>
              <Button onClick={openCreate} className="hidden md:inline-flex">
                <PlusIcon />
                {t("addGuest")}
              </Button>
            </>
          )}
        </div>
      </div>

      {persons.length > 0 && (
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {filtered.length > 0 ? (
        <>
          {/* Mobile: grouped card list */}
          <div className="space-y-1 md:hidden">
            {sections.map((section) => {
              const isExpanded = expandedGroups.has(section.key)
              const allInSectionSelected = section.persons.every((p) =>
                selectedIds.has(p.id)
              )

              // Placement summary for section header
              const membersWithBooking = section.persons.filter((p) => p.booked_table)
              const correctCount = membersWithBooking.filter((p) => {
                if (!p.table_ref) return false
                const actual = tableLabels.get(p.table_ref)
                return actual === p.booked_table
              }).length
              const wrongCount = membersWithBooking.filter((p) => {
                if (!p.table_ref) return false
                const actual = tableLabels.get(p.table_ref)
                return actual && actual !== p.booked_table
              }).length
              const hasPlacementInfo = membersWithBooking.length > 0 && (correctCount > 0 || wrongCount > 0)

              return (
                <div key={section.key}>
                  {/* Section header */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    onClick={() => {
                      if (selectMode) {
                        toggleSectionSelect(section.persons.map((p) => p.id))
                      } else {
                        toggleExpanded(section.key)
                      }
                    }}
                  >
                    {selectMode && (
                      allInSectionSelected ? (
                        <CheckCircle2Icon className="size-4 text-primary shrink-0" />
                      ) : (
                        <CircleIcon className="size-4 text-muted-foreground shrink-0" />
                      )
                    )}
                    {section.color && (
                      <div
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: section.color }}
                      />
                    )}
                    <span className="text-xs font-medium text-muted-foreground flex-1">
                      {section.label} ({section.persons.length})
                    </span>
                    {!selectMode && hasPlacementInfo && (
                      wrongCount > 0 ? (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                          {wrongCount}/{membersWithBooking.length} ✗
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-600 dark:border-green-700 dark:text-green-400">
                          {correctCount}/{membersWithBooking.length} ✓
                        </Badge>
                      )
                    )}
                    {!selectMode && (
                      <ChevronDownIcon
                        className={`size-4 text-muted-foreground transition-transform ${
                          isExpanded ? "" : "-rotate-90"
                        }`}
                      />
                    )}
                  </button>

                  {/* Section persons */}
                  {isExpanded &&
                    section.persons.map((person, idx) => {
                      const group = person.group_id
                        ? groupMap.get(person.group_id)
                        : null
                      const isSeated = person.table_ref && person.seat_ref
                      const isSelected = selectedIds.has(person.id)
                      const actualTableLabel = person.table_ref ? tableLabels.get(person.table_ref) : null
                      const isCorrect = isSeated && person.booked_table && actualTableLabel === person.booked_table
                      const isWrong = isSeated && person.booked_table && actualTableLabel && actualTableLabel !== person.booked_table

                      // Connector line between consecutive group members
                      const prev = idx > 0 ? section.persons[idx - 1] : null
                      const showConnector = prev && section.key !== UNGROUPED_KEY
                      let connectorColor = "border-border"
                      if (showConnector) {
                        const prevSeated = prev.table_ref && prev.seat_ref
                        if (isSeated && prevSeated && person.table_ref === prev.table_ref) {
                          connectorColor = "border-green-400 dark:border-green-600"
                        } else if (isSeated && prevSeated) {
                          connectorColor = "border-amber-400 dark:border-amber-600"
                        }
                      }

                      return (
                        <div key={person.id}>
                          {showConnector && (
                            <div className="flex px-3">
                              <div
                                className={`ml-[14px] h-2 border-l-2 border-dotted ${connectorColor}`}
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left active:bg-accent transition-colors"
                            onClick={() => {
                              if (selectMode) {
                                toggleSelect(person.id)
                              } else {
                                openEdit(person)
                              }
                            }}
                          >
                            {selectMode ? (
                              isSelected ? (
                                <CheckCircle2Icon className="size-5 shrink-0 text-primary" />
                              ) : (
                                <CircleIcon className="size-5 shrink-0 text-muted-foreground" />
                              )
                            ) : (
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                                <UserIcon className="size-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {person.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                {group && (
                                  <span
                                    className="text-[11px] font-medium"
                                    style={{ color: group.color }}
                                  >
                                    {group.name}
                                  </span>
                                )}
                                {isCorrect ? (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-green-50 px-1 text-[10px] text-green-700 dark:bg-green-950 dark:text-green-400">
                                    <CheckCircle2Icon className="size-3" />
                                    {actualTableLabel}
                                  </span>
                                ) : isWrong ? (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                    <AlertTriangleIcon className="size-3" />
                                    {actualTableLabel}
                                    <span className="text-[9px] opacity-75">
                                      ({t("bookedLabel", { table: person.booked_table! })})
                                    </span>
                                  </span>
                                ) : isSeated && actualTableLabel ? (
                                  <span className="rounded bg-primary/10 px-1 text-[10px] text-primary">
                                    {actualTableLabel}
                                  </span>
                                ) : isSeated ? (
                                  <span className="rounded bg-primary/10 px-1 text-[10px] text-primary">
                                    {t("seated")}
                                  </span>
                                ) : person.booked_table ? (
                                  <span className="text-[10px] text-muted-foreground">
                                    {t("notSeated")}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">
                                    {t("notSeated")}
                                  </span>
                                )}
                                {!isSeated && person.booked_table && (
                                  <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                                    {person.booked_table}
                                  </span>
                                )}
                              </div>
                            </div>
                            {!selectMode && (
                              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      )
                    })}
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectMode && <TableHead className="w-10" />}
                  <TableHead>{tc("name")}</TableHead>
                  <TableHead>{t("group")}</TableHead>
                  <TableHead>{t("bookedTable")}</TableHead>
                  <TableHead>{t("placement")}</TableHead>
                  {!selectMode && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFiltered.map((person, idx) => {
                  const group = person.group_id
                    ? groupMap.get(person.group_id)
                    : null
                  const isSeated = person.table_ref && person.seat_ref
                  const isSelected = selectedIds.has(person.id)
                  const actualTableLabel = person.table_ref ? tableLabels.get(person.table_ref) : null
                  const isCorrect = isSeated && person.booked_table && actualTableLabel === person.booked_table
                  const isWrong = isSeated && person.booked_table && actualTableLabel && actualTableLabel !== person.booked_table

                  // Dotted connector: check if same group as previous row
                  const prev = idx > 0 ? sortedFiltered[idx - 1] : null
                  const sameGroup = prev && person.group_id && person.group_id === prev.group_id
                  let rowBorderClass = ""
                  if (sameGroup) {
                    const prevSeated = prev.table_ref && prev.seat_ref
                    if (isSeated && prevSeated && person.table_ref === prev.table_ref) {
                      rowBorderClass = "border-l-2 border-dotted border-green-400 dark:border-green-600"
                    } else if (isSeated && prevSeated) {
                      rowBorderClass = "border-l-2 border-dotted border-amber-400 dark:border-amber-600"
                    } else {
                      rowBorderClass = "border-l-2 border-dotted border-border"
                    }
                  }

                  return (
                    <TableRow
                      key={person.id}
                      className={`${selectMode ? "cursor-pointer" : ""} ${rowBorderClass}`}
                      onClick={
                        selectMode
                          ? () => toggleSelect(person.id)
                          : undefined
                      }
                    >
                      {selectMode && (
                        <TableCell>
                          {isSelected ? (
                            <CheckCircle2Icon className="size-4 text-primary" />
                          ) : (
                            <CircleIcon className="size-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {person.name}
                      </TableCell>
                      <TableCell>
                        {group ? (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: group.color,
                              color: group.color,
                            }}
                          >
                            {group.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {person.booked_table ? (
                          <Badge variant="secondary">
                            {person.booked_table}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isCorrect ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-300">
                            <CheckCircle2Icon className="size-3" />
                            {actualTableLabel}
                          </Badge>
                        ) : isWrong ? (
                          <div className="flex items-center gap-1">
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-300">
                              <AlertTriangleIcon className="size-3" />
                              {actualTableLabel}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              ({t("bookedLabel", { table: person.booked_table! })})
                            </span>
                          </div>
                        ) : isSeated && actualTableLabel ? (
                          <Badge variant="secondary">{actualTableLabel}</Badge>
                        ) : isSeated ? (
                          <Badge variant="secondary">{t("seated")}</Badge>
                        ) : (
                          <Badge variant="outline">{t("notSeated")}</Badge>
                        )}
                      </TableCell>
                      {!selectMode && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEdit(person)}
                            >
                              <PencilIcon className="size-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-destructive"
                                  />
                                }
                              >
                                <Trash2Icon className="size-4" />
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t("deleteGuest")}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("deleteGuestDescription", {
                                      name: person.name,
                                    })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {tc("cancel")}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(person.id)}
                                  >
                                    {t("removeConfirm")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : persons.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-muted-foreground">{t("noGuests")}</p>
          <Button onClick={openCreate}>
            <PlusIcon />
            {t("addFirstGuest")}
          </Button>
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          {t("noResults")}
        </div>
      )}

      {/* Multi-select action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background p-3 flex items-center gap-3 safe-area-bottom">
          <span className="text-sm font-medium flex-1">
            {t("selectedCount", { count: selectedIds.size })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            <UsersIcon className="size-4" />
            {t("assignGroup")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  disabled={bulkDeleting}
                />
              }
            >
              {bulkDeleting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <Trash2Icon className="size-4" />
              )}
              {tc("delete")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteGuest")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("bulkDeleteConfirm", { count: selectedIds.size })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkDelete}>
                  {t("removeConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Group picker sheet for multi-select */}
      <GroupPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        groups={groups}
        selectedPersons={selectedPersons}
        eventId={params.id}
        onDone={() => {
          setSelectedIds(new Set())
          setSelectMode(false)
          fetchData()
        }}
      />

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent key={`${editPerson?.id ?? "new"}-${editCounter.current}`}>
          <DialogHeader>
            <DialogTitle>
              {editPerson ? t("editGuest") : t("newGuest")}
            </DialogTitle>
            <DialogDescription>
              {editPerson ? t("editGuestDescription") : t("newGuestDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{tc("name")}</Label>
              <Input
                id="name"
                name="name"
                defaultValue={editPerson?.name}
                placeholder={t("namePlaceholder")}
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-group">{t("group")}</Label>
              <Select
                value={dialogGroupId}
                onValueChange={(v) => { if (v) setDialogGroupId(v) }}
                items={{
                  [NO_GROUP_VALUE]: t("noGroup"),
                  ...Object.fromEntries(groups.map((g) => [g.id, g.name])),
                }}
              >
                <SelectTrigger id="guest-group">
                  <SelectValue placeholder={t("noGroup")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GROUP_VALUE}>{t("noGroup")}</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id} label={g.name}>
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: g.color }}
                      />
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="booked_table">{t("bookedTable")}</Label>
              <Input
                id="booked_table"
                name="booked_table"
                defaultValue={editPerson?.booked_table ?? ""}
                placeholder={t("bookedTablePlaceholder")}
                disabled={saving}
              />
            </div>
            <DialogFooter className="flex-row gap-2">
              {editPerson && (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive mr-auto"
                      />
                    }
                  >
                    <Trash2Icon className="size-4" />
                    <span className="md:hidden">{tc("delete")}</span>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("deleteGuest")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("deleteGuestDescription", { name: editPerson.name })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          handleDelete(editPerson.id)
                          setDialogOpen(false)
                        }}
                      >
                        {t("removeConfirm")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="animate-spin" />}
                {editPerson ? tc("save") : tc("add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
