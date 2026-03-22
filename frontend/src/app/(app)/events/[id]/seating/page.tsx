"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core"
import { ArrowLeftIcon, Loader2Icon, UserIcon, WifiOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GuestPanel } from "@/components/floorplan/guest-panel"
import { ParkingArea } from "@/components/floorplan/parking-area"
import { MobileGuestSheet } from "@/components/floorplan/mobile-guest-sheet"
import { AssignModeBar } from "@/components/floorplan/assign-mode-bar"
import { SeatAssignDialog } from "@/components/floorplan/seat-assign-dialog"
import { apiFetch } from "@/lib/api"
import {
  migrateLayout,
  computeSeatsForTable,
  hitTest,
  computeSinglePlacement,
  computeGroupPlacement,
  getGroupBlockedSeats,
} from "@/lib/floorplan"
import { useEventStream, type SSEEventType } from "@/hooks/use-event-stream"
import { useRequireRole } from "@/hooks/use-require-role"
import { useIsMobile } from "@/hooks/use-mobile"
import { toast } from "sonner"
import type {
  FloorPlan,
  FloorPlanLayout,
  Event,
  Person,
  Group,
  ComputedSeat,
} from "@/lib/types"

import type { FloorPlanViewState } from "@/components/floorplan/editor"

const FloorPlanEditor = dynamic(
  () =>
    import("@/components/floorplan/editor").then((mod) => mod.FloorPlanEditor),
  { ssr: false, loading: () => <EditorSkeleton /> }
)

function EditorSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
    </div>
  )
}

const EMPTY_LAYOUT: FloorPlanLayout = {
  tables: [],
  shapes: [],
  width: 1200,
  height: 800,
}

export default function SeatingPage() {
  const t = useTranslations("events")
  const tf = useTranslations("floorplan")
  const tc = useTranslations("common")
  const ts = useTranslations("success")
  const te = useTranslations("errors")
  const params = useParams<{ id: string }>()
  const { loading: authLoading, allowed } = useRequireRole(["admin", "editor"])
  const isMobile = useIsMobile()

  const [event, setEvent] = useState<Event | null>(null)
  const [persons, setPersons] = useState<Person[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [layout, setLayout] = useState<FloorPlanLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [selectedTableLabel, setSelectedTableLabel] = useState<string | null>(
    null
  )

  const [activeDrag, setActiveDrag] = useState<{
    type: "person" | "group"
    id: string
    name: string
    personIds: string[]
  } | null>(null)

  const [assignDialog, setAssignDialog] = useState<{
    open: boolean
    tableId: string
    seatRef: string
    seatLabel: string
    tableLabel: string
  }>({ open: false, tableId: "", seatRef: "", seatLabel: "", tableLabel: "" })

  const [unseatTarget, setUnseatTarget] = useState<{ id: string; name: string } | null>(null)

  const [highlightTableId, setHighlightTableId] = useState<string | null>(null)
  const [previewSeats, setPreviewSeats] = useState<
    { x: number; y: number; initials: string; color?: string }[]
  >([])

  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const viewStateRef = useRef<FloorPlanViewState>({ scale: 1, x: 0, y: 0 })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const allSeats = useMemo(() => {
    if (!layout) return new Map<string, ComputedSeat[]>()
    const map = new Map<string, ComputedSeat[]>()
    for (const table of layout.tables) {
      map.set(table.id, computeSeatsForTable(table))
    }
    return map
  }, [layout])

  const occupiedSeatRefs = useMemo(() => {
    const set = new Set<string>()
    for (const p of persons) {
      if (p.table_ref && p.seat_ref) {
        set.add(`${p.table_ref}:${p.seat_ref}`)
      }
    }
    return set
  }, [persons])

  // "tableId:seatRef" → groupId for seated group members
  const seatGroupMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of persons) {
      if (p.group_id && p.table_ref && p.seat_ref) {
        map.set(`${p.table_ref}:${p.seat_ref}`, p.group_id)
      }
    }
    return map
  }, [persons])

  // Reverse lookup: "tableId:seatRef" → personId
  const seatRefToPersonId = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of persons) {
      if (p.table_ref && p.seat_ref) {
        map.set(`${p.table_ref}:${p.seat_ref}`, p.id)
      }
    }
    return map
  }, [persons])

  // Resolve the selected person's booked table to a table ID
  const assignTableId = useMemo(() => {
    if (!selectedPersonId || !layout) return null
    const person = persons.find((p) => p.id === selectedPersonId)
    if (!person?.booked_table) return null
    const table = layout.tables.find((t) => t.label === person.booked_table)
    return table?.id ?? null
  }, [selectedPersonId, persons, layout])

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [e, p, g] = await Promise.all([
        apiFetch<Event>(`/events/${params.id}`, { signal }),
        apiFetch<Person[]>(`/events/${params.id}/persons`, { signal }).catch(() => []),
        apiFetch<Group[]>(`/events/${params.id}/groups`, { signal }).catch(() => []),
      ])
      if (signal?.aborted) return
      setEvent(e)
      setPersons(p ?? [])
      setGroups(g ?? [])

      try {
        const fp = await apiFetch<FloorPlan>(`/events/${params.id}/floorplan`, { signal })
        if (signal?.aborted) return
        setLayout(
          migrateLayout((fp.layout as any) ?? { ...EMPTY_LAYOUT })
        )
      } catch {
        if (signal?.aborted) return
        setLayout({ ...EMPTY_LAYOUT })
      }
    } catch (err: any) {
      if (signal?.aborted) return
      toast.error(te("eventLoadFailed"))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [params.id, te])

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData])

  // ── SSE real-time sync ──────────────────────────────────────

  const handleSSEEvent = useCallback(
    (type: SSEEventType, data: any) => {
      switch (type) {
        case "person_created":
          setPersons((prev) => {
            if (prev.some((p) => p.id === data.id)) return prev
            return [...prev, data as Person]
          })
          break
        case "person_updated":
        case "seat_assigned":
        case "person_parked":
          setPersons((prev) =>
            prev.map((p) => (p.id === data.id ? (data as Person) : p))
          )
          break
        case "person_deleted":
          setPersons((prev) => prev.filter((p) => p.id !== data.id))
          break
        case "seats_swapped":
          if (Array.isArray(data)) {
            setPersons((prev) => {
              const map = new Map(
                (data as Person[]).map((p) => [p.id, p])
              )
              return prev.map((p) => map.get(p.id) ?? p)
            })
          }
          break
        case "bulk_assigned":
          if (data.assigned && Array.isArray(data.assigned)) {
            setPersons((prev) => {
              const map = new Map(
                (data.assigned as Person[]).map((p: Person) => [p.id, p])
              )
              return prev.map((p) => map.get(p.id) ?? p)
            })
          }
          break
        case "floorplan_updated":
          if (data.layout) {
            setLayout(migrateLayout(data.layout))
          }
          break
      }
    },
    []
  )

  const { isConnected: isSSEConnected } = useEventStream({
    eventId: params.id,
    onEvent: handleSSEEvent,
    enabled: !loading,
  })

  // ── Seat click ───────────────────────────────────────────

  async function handleSeatClick(tableId: string, seatRef: string) {
    if (selectedPersonId) {
      // Block if seat is reserved by another group
      const person = persons.find((p) => p.id === selectedPersonId)
      const tableSeats = allSeats.get(tableId) ?? []
      const blocked = getGroupBlockedSeats(tableId, tableSeats, seatGroupMap, person?.group_id ?? null)
      if (blocked.has(`${tableId}:${seatRef}`)) {
        toast.error(te("seatReservedByGroup"))
        return
      }

      try {
        const updated = await apiFetch<Person>(
          `/persons/${selectedPersonId}/seat`,
          {
            method: "PUT",
            body: JSON.stringify({ table_ref: tableId, seat_ref: seatRef }),
          }
        )
        setPersons((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        )
        setSelectedPersonId(null)
        toast.success(ts("guestPlaced"))
        fetchData()
      } catch (err: any) {
        toast.error(err.message ?? te("placeFailed"))
      }
      return
    }

    const occupant = persons.find(
      (p) => p.table_ref === tableId && p.seat_ref === seatRef
    )
    if (occupant) {
      setUnseatTarget({ id: occupant.id, name: occupant.name })
      return
    }

    const table = layout?.tables.find((t) => t.id === tableId)
    const seats = allSeats.get(tableId) ?? []
    const seat = seats.find((s) => s.seatRef === seatRef)
    setAssignDialog({
      open: true,
      tableId,
      seatRef,
      seatLabel: seat?.label ?? seatRef,
      tableLabel: table?.label ?? tableId,
    })
  }

  async function handleCreateAndAssign(name: string) {
    const { tableId, seatRef } = assignDialog
    try {
      const person = await apiFetch<Person>(
        `/events/${params.id}/persons`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            table_ref: tableId,
            seat_ref: seatRef,
          }),
        }
      )
      setPersons((prev) => [...prev, person])
      toast.success(ts("namePlaced", { name }))
      fetchData()
    } catch (err: any) {
      toast.error(err.message ?? te("createFailed"))
    }
  }

  async function handleUnseat(personId: string) {
    try {
      const updated = await apiFetch<Person>(`/persons/${personId}/park`, {
        method: "PUT",
      })
      setPersons((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      )
      toast.success(ts("guestRemoved"))
      fetchData()
    } catch (err: any) {
      toast.error(err.message ?? te("placeFailed"))
    }
  }

  // ── Coordinate conversion ────────────────────────────────

  function screenToCanvas(screenX: number, screenY: number) {
    const rect = canvasContainerRef.current?.getBoundingClientRect()
    if (!rect) return { x: screenX, y: screenY }
    const { scale, x: posX, y: posY } = viewStateRef.current
    return {
      x: (screenX - rect.left - posX) / scale,
      y: (screenY - rect.top - posY) / scale,
    }
  }

  // ── Canvas seat drag (move placed person) ───────────────

  async function handleSeatDragEnd(personId: string, canvasX: number, canvasY: number) {
    if (!layout) {
      // Force re-render to restore Konva styling after cancelled drag
      setPersons((prev) => [...prev])
      return
    }

    const hit = hitTest(canvasX, canvasY, layout.tables, allSeats)
    if (hit.type === "none" || !hit.tableId) {
      setPersons((prev) => [...prev])
      return
    }

    const tableSeats = allSeats.get(hit.tableId) ?? []

    // Exclude the dragged person's own seat so they can land on a free seat
    const adjustedOccupied = new Set(occupiedSeatRefs)
    const person = persons.find((p) => p.id === personId)
    if (person?.table_ref && person?.seat_ref) {
      adjustedOccupied.delete(`${person.table_ref}:${person.seat_ref}`)
    }
    // Block seats reserved by other groups
    for (const key of getGroupBlockedSeats(hit.tableId, tableSeats, seatGroupMap, person?.group_id ?? null)) {
      adjustedOccupied.add(key)
    }

    const result = computeSinglePlacement(
      personId,
      hit.tableId,
      tableSeats,
      adjustedOccupied,
      hit.seat?.x ?? canvasX,
      hit.seat?.y ?? canvasY
    )

    if (result.success && result.assignments.length > 0) {
      const a = result.assignments[0]
      // Optimistic update — move person instantly before API call
      setPersons((prev) =>
        prev.map((p) =>
          p.id === a.personId
            ? { ...p, table_ref: a.tableId, seat_ref: a.seatRef }
            : p
        )
      )
      try {
        const updated = await apiFetch<Person>(
          `/persons/${a.personId}/seat`,
          {
            method: "PUT",
            body: JSON.stringify({
              table_ref: a.tableId,
              seat_ref: a.seatRef,
            }),
          }
        )
        setPersons((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        )
        toast.success(ts("guestPlaced"))
        fetchData()
      } catch (err: any) {
        // Revert optimistic update
        if (person) {
          setPersons((prev) =>
            prev.map((p) =>
              p.id === personId
                ? { ...p, table_ref: person.table_ref, seat_ref: person.seat_ref }
                : p
            )
          )
        }
        toast.error(err.message ?? te("placeFailed"))
      }
    } else {
      setPersons((prev) => [...prev])
      toast.error(result.message ?? te("placementFailed"))
    }
  }

  // ── Drag and drop ────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setPreviewSeats([])
    const data = event.active.data.current as any
    if (!data) return

    if (data.type === "person") {
      setActiveDrag({
        type: "person",
        id: data.personId,
        name: data.name,
        personIds: [data.personId],
      })
    } else if (data.type === "group") {
      const group = groups.find((g) => g.id === data.groupId)
      setActiveDrag({
        type: "group",
        id: data.groupId,
        name: group?.name ?? "Gruppe",
        personIds: data.personIds,
      })
    }
  }

  function handleDragMove(event: DragMoveEvent) {
    if (!layout) {
      setHighlightTableId(null)
      setPreviewSeats([])
      return
    }
    const px = (event.activatorEvent as PointerEvent).clientX + (event.delta?.x ?? 0)
    const py = (event.activatorEvent as PointerEvent).clientY + (event.delta?.y ?? 0)
    const canvas = screenToCanvas(px, py)
    const hit = hitTest(canvas.x, canvas.y, layout.tables, allSeats)
    setHighlightTableId(hit.tableId ?? null)

    // Compute seat preview for group drags
    if (activeDrag?.type === "group" && hit.tableId) {
      const table = layout.tables.find((t) => t.id === hit.tableId)
      if (table) {
        // Exclude dragged group members' current seats (enables move preview)
        const adjustedOccupied = new Set(occupiedSeatRefs)
        for (const pid of activeDrag.personIds) {
          const person = persons.find((p) => p.id === pid)
          if (person?.table_ref && person?.seat_ref) {
            adjustedOccupied.delete(`${person.table_ref}:${person.seat_ref}`)
          }
        }

        const result = computeGroupPlacement(
          activeDrag.personIds,
          table,
          hit.edge ?? "center",
          adjustedOccupied
        )

        const tableSeats = allSeats.get(table.id) ?? []
        const group = groups.find((g) => g.id === activeDrag.id)

        const preview = result.assignments.map((a) => {
          const seat = tableSeats.find((s) => s.seatRef === a.seatRef)
          const person = persons.find((p) => p.id === a.personId)
          return {
            x: seat?.x ?? 0,
            y: seat?.y ?? 0,
            initials: person ? person.name.slice(0, 2).toUpperCase() : "??",
            color: group?.color,
          }
        })
        setPreviewSeats(preview)
      } else {
        setPreviewSeats([])
      }
    } else {
      setPreviewSeats([])
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const drag = activeDrag
    setActiveDrag(null)
    setHighlightTableId(null)
    setPreviewSeats([])
    if (!drag || !layout) return

    if (event.over?.id === "parking-area") {
      for (const personId of drag.personIds) {
        const person = persons.find((p) => p.id === personId)
        if (person?.table_ref && person?.seat_ref) {
          await handleUnseat(personId)
        }
      }
      return
    }

    if (!canvasContainerRef.current) return

    const containerRect = canvasContainerRef.current.getBoundingClientRect()
    const screenX = (event.activatorEvent as PointerEvent).clientX + (event.delta?.x ?? 0)
    const screenY = (event.activatorEvent as PointerEvent).clientY + (event.delta?.y ?? 0)

    if (
      screenX < containerRect.left ||
      screenX > containerRect.right ||
      screenY < containerRect.top ||
      screenY > containerRect.bottom
    ) {
      return
    }

    const canvas = screenToCanvas(screenX, screenY)
    const hit = hitTest(canvas.x, canvas.y, layout.tables, allSeats)

    if (hit.type === "none") return

    const tableId = hit.tableId
    if (!tableId) return

    const table = layout.tables.find((t) => t.id === tableId)
    if (!table) return

    const tableSeats = allSeats.get(tableId) ?? []

    if (drag.type === "person") {
      const dragPerson = persons.find((p) => p.id === drag.personIds[0])
      const blockedOccupied = new Set(occupiedSeatRefs)
      for (const key of getGroupBlockedSeats(tableId, tableSeats, seatGroupMap, dragPerson?.group_id ?? null)) {
        blockedOccupied.add(key)
      }
      const result = computeSinglePlacement(
        drag.personIds[0],
        tableId,
        tableSeats,
        blockedOccupied,
        hit.seat?.x,
        hit.seat?.y
      )

      if (result.success && result.assignments.length > 0) {
        const a = result.assignments[0]
        try {
          const updated = await apiFetch<Person>(
            `/persons/${a.personId}/seat`,
            {
              method: "PUT",
              body: JSON.stringify({
                table_ref: a.tableId,
                seat_ref: a.seatRef,
              }),
            }
          )
          setPersons((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          )
          toast.success(ts("guestPlaced"))
          fetchData()
        } catch (err: any) {
          toast.error(err.message ?? te("placeFailed"))
        }
      } else {
        toast.error(result.message ?? te("placementFailed"))
      }
    } else if (drag.type === "group") {
      // Exclude dragged group members' current seats (enables move)
      const adjustedOccupied = new Set(occupiedSeatRefs)
      for (const pid of drag.personIds) {
        const person = persons.find((p) => p.id === pid)
        if (person?.table_ref && person?.seat_ref) {
          adjustedOccupied.delete(`${person.table_ref}:${person.seat_ref}`)
        }
      }

      const result = computeGroupPlacement(
        drag.personIds,
        table,
        hit.edge ?? "center",
        adjustedOccupied
      )

      if (result.assignments.length > 0) {
        try {
          const res = await apiFetch<{ assigned: Person[] }>(
            `/persons/bulk-assign`,
            {
              method: "POST",
              body: JSON.stringify({
                assignments: result.assignments.map((a) => ({
                  person_id: a.personId,
                  table_ref: a.tableId,
                  seat_ref: a.seatRef,
                })),
              }),
            }
          )
          if (res.assigned) {
            setPersons((prev) => {
              const updatedMap = new Map(
                res.assigned.map((p: Person) => [p.id, p])
              )
              return prev.map((p) => updatedMap.get(p.id) ?? p)
            })
          }
          if (result.overflow.length > 0) {
            toast.warning(result.message ?? ts("overflowWarning", { count: result.overflow.length }))
          } else {
            toast.success(ts("guestsPlaced", { count: result.assignments.length }))
          }
          fetchData()
        } catch (err: any) {
          toast.error(err.message ?? te("groupPlaceFailed"))
        }
      } else {
        toast.error(result.message ?? te("noSeatsAvailable"))
      }
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-[calc(100svh-3.5rem)] items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!allowed) return null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-[calc(100svh-3.5rem)] flex-col -m-4 md:-m-6">
        {/* SSE disconnected banner */}
        {!isSSEConnected && !loading && (
          <div className="flex h-8 shrink-0 items-center justify-center gap-2 bg-destructive/10 text-destructive text-xs">
            <WifiOffIcon className="size-3.5" />
            {tf("sseDisconnected")}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            render={<Link href={`/events/${params.id}`} />}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="font-medium truncate">{event?.name}</span>
          <span className="text-sm text-muted-foreground">— {t("seating")}</span>
          <div className="flex-1" />
          {selectedPersonId && (
            <span className="hidden text-xs text-primary animate-pulse md:inline">
              {t("clickFreeSeat")}
            </span>
          )}
        </div>

        {/* Editor + Guest panel */}
        <div className="flex flex-1 overflow-hidden">
          <div ref={canvasContainerRef} className="flex-1 overflow-hidden">
            {layout && (
              <FloorPlanEditor
                mode="seating"
                layout={layout}
                persons={persons}
                groups={groups}
                onLayoutChange={() => {}}
                onPersonUpdate={(updated) => {
                  setPersons((prev) =>
                    prev.map((p) => (p.id === updated.id ? updated : p))
                  )
                }}
                selectedPersonId={selectedPersonId}
                onSeatClick={handleSeatClick}
                onUnseat={handleUnseat}
                onTableSelect={setSelectedTableLabel}
                viewStateRef={viewStateRef}
                highlightTableId={highlightTableId}
                assignTableId={assignTableId}
                focusTableId={assignTableId}
                previewSeats={previewSeats}
                onSeatDragEnd={handleSeatDragEnd}
              />
            )}
          </div>

          {/* Desktop only: sidebar */}
          {!isMobile && (
            <GuestPanel
              persons={persons}
              groups={groups}
              selectedPersonId={selectedPersonId}
              onSelectPerson={setSelectedPersonId}
              selectedTableLabel={selectedTableLabel}
              draggable
            >
              <ParkingArea
                persons={persons}
                onUnseat={handleUnseat}
                draggable
              />
            </GuestPanel>
          )}
        </div>
      </div>

      {/* Mobile only: FAB + sheet (hidden during assign mode) */}
      {isMobile && !selectedPersonId && (
        <MobileGuestSheet
          persons={persons}
          groups={groups}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
          selectedTableLabel={selectedTableLabel}
          onUnseat={handleUnseat}
        />
      )}

      {/* Mobile only: assign-mode bar */}
      {isMobile && selectedPersonId && (
        <AssignModeBar
          personName={persons.find((p) => p.id === selectedPersonId)?.name ?? ""}
          bookedTable={persons.find((p) => p.id === selectedPersonId)?.booked_table}
          onCancel={() => setSelectedPersonId(null)}
        />
      )}

      {/* Drag overlay */}
      <DragOverlay>
        {activeDrag && (
          <div className="flex items-center gap-2 rounded-md bg-background/90 px-3 py-2 shadow-lg ring-1 ring-primary/30">
            <UserIcon className="size-4 text-primary" />
            <span className="text-sm font-medium">{activeDrag.name}</span>
            {activeDrag.type === "group" && (
              <span className="text-xs text-muted-foreground">
                ({activeDrag.personIds.length})
              </span>
            )}
          </div>
        )}
      </DragOverlay>

      {/* Unseat confirmation dialog */}
      <AlertDialog
        open={!!unseatTarget}
        onOpenChange={(open) => { if (!open) setUnseatTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tf("guests.unseatConfirm", { name: unseatTarget?.name ?? "" })}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (unseatTarget) {
                  handleUnseat(unseatTarget.id)
                  setUnseatTarget(null)
                }
              }}
            >
              {tf("guests.unseatAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Seat assign dialog */}
      <SeatAssignDialog
        open={assignDialog.open}
        onOpenChange={(open) =>
          setAssignDialog((prev) => ({ ...prev, open }))
        }
        seatLabel={assignDialog.seatLabel}
        tableLabel={assignDialog.tableLabel}
        onConfirm={handleCreateAndAssign}
      />
    </DndContext>
  )
}
