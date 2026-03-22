"use client"

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Loader2Icon,
  SearchIcon,
  UserIcon,
  XIcon,
  UserPlusIcon,
  ChevronUpIcon,
  WandSparklesIcon,
  PlusIcon,
  MinusIcon,
} from "lucide-react"
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { computeSeatsForTable, getTotalSeatCount, generateId, DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT } from "@/lib/floorplan"
import { migrateLayout } from "@/lib/floorplan"
import type {
  Person,
  FloorPlan,
  FloorPlanTable,
  FloorPlanLayout,
  ComputedSeat,
} from "@/lib/types"

// ── Drag data types ───────────────────────────────────────────

interface DragDataPerson {
  type: "person"
  person: Person
}

interface DragDataSeat {
  type: "seated-person"
  person: Person
  fromTableId: string
  fromSeatRef: string
}

type DragData = DragDataPerson | DragDataSeat

// ── Page ──────────────────────────────────────────────────────

export default function PlannerPage() {
  const params = useParams<{ id: string }>()
  const t = useTranslations("events")
  const tg = useTranslations("guests")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const tf = useTranslations("floorplan.setup")

  const [persons, setPersons] = useState<Person[]>([])
  const [layout, setLayout] = useState<FloorPlanLayout | null>(null)
  const [floorplanVersion, setFloorplanVersion] = useState(0)
  const [loading, setLoading] = useState(true)

  // Drag state
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null)
  const [overSeatId, setOverSeatId] = useState<string | null>(null)

  // Unseat dialog
  const [unseatPerson, setUnseatPerson] = useState<Person | null>(null)
  const [unseating, setUnseating] = useState(false)

  // Guest panel
  const [panelOpen, setPanelOpen] = useState(true)
  const [panelSearch, setPanelSearch] = useState("")

  // Assign dialog (fallback for tap on empty seat)
  const [assignSeat, setAssignSeat] = useState<{
    table: FloorPlanTable
    seat: ComputedSeat
  } | null>(null)
  const [assignSearch, setAssignSearch] = useState("")
  const [assigning, setAssigning] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Auto-place state
  const [autoPlacing, setAutoPlacing] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      apiFetch<Person[]>(`/events/${params.id}/persons`),
      apiFetch<FloorPlan>(`/events/${params.id}/floorplan`).catch(() => null),
    ])
      .then(([p, fp]) => {
        setPersons(p ?? [])
        if (fp) {
          setFloorplanVersion(fp.version)
          if (fp.layout) {
            setLayout(migrateLayout(fp.layout as any))
          }
        }
      })
      .catch(() => toast.error(te("loadFailed")))
      .finally(() => setLoading(false))
  }, [params.id, te])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Build lookup maps
  const seatPersonMap = useMemo(() => {
    const map = new Map<string, Person>()
    for (const p of persons) {
      if (p.table_ref && p.seat_ref) {
        map.set(`${p.table_ref}:${p.seat_ref}`, p)
      }
    }
    return map
  }, [persons])

  const unassigned = useMemo(
    () => persons.filter((p) => !p.table_ref || !p.seat_ref),
    [persons]
  )

  const filteredUnassigned = useMemo(() => {
    if (!panelSearch.trim()) return unassigned
    const q = panelSearch.toLowerCase()
    return unassigned.filter((p) => p.name.toLowerCase().includes(q))
  }, [unassigned, panelSearch])

  const dialogFilteredUnassigned = useMemo(() => {
    if (!assignSearch.trim()) return unassigned
    const q = assignSearch.toLowerCase()
    return unassigned.filter((p) => p.name.toLowerCase().includes(q))
  }, [unassigned, assignSearch])

  const tables = layout?.tables ?? []

  // Compute all empty seats across all tables
  const allEmptySeats = useMemo(() => {
    const empty: { tableId: string; seatRef: string }[] = []
    for (const table of tables) {
      const seats = computeSeatsForTable(table)
      for (const seat of seats) {
        if (!seatPersonMap.has(`${table.id}:${seat.seatRef}`)) {
          empty.push({ tableId: table.id, seatRef: seat.seatRef })
        }
      }
    }
    return empty
  }, [tables, seatPersonMap])

  // ── DnD handlers ────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData
    setActiveDrag(data)
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id as string | null
    setOverSeatId(overId ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const dragData = activeDrag
    setActiveDrag(null)
    setOverSeatId(null)

    if (!dragData || !event.over) return

    const dropId = event.over.id as string
    // dropId format: "seat:tableId:seatRef"
    if (!dropId.startsWith("seat:")) return

    const [, targetTableId, targetSeatRef] = dropId.split(":")
    const targetKey = `${targetTableId}:${targetSeatRef}`
    const existingPerson = seatPersonMap.get(targetKey)

    if (dragData.type === "person") {
      // Dragging unassigned person to a seat
      if (existingPerson) return // seat occupied, ignore
      await assignPerson(dragData.person.id, targetTableId, targetSeatRef)
    } else if (dragData.type === "seated-person") {
      if (existingPerson) {
        // Swap two seated persons
        await swapPersons(dragData.person.id, existingPerson.id)
      } else {
        // Move seated person to empty seat
        await assignPerson(dragData.person.id, targetTableId, targetSeatRef)
      }
    }
  }

  async function assignPerson(personId: string, tableId: string, seatRef: string) {
    try {
      await apiFetch(`/persons/${personId}/seat`, {
        method: "PUT",
        body: JSON.stringify({ table_ref: tableId, seat_ref: seatRef }),
      })
      setPersons((prev) =>
        prev.map((p) =>
          p.id === personId
            ? { ...p, table_ref: tableId, seat_ref: seatRef, parked: false }
            : p
        )
      )
    } catch (err: any) {
      toast.error(err.message ?? te("placeFailed"))
    }
  }

  async function swapPersons(personAId: string, personBId: string) {
    try {
      await apiFetch(`/persons/swap`, {
        method: "POST",
        body: JSON.stringify({ person_a_id: personAId, person_b_id: personBId }),
      })
      // Swap locally
      setPersons((prev) => {
        const a = prev.find((p) => p.id === personAId)
        const b = prev.find((p) => p.id === personBId)
        if (!a || !b) return prev
        return prev.map((p) => {
          if (p.id === personAId) {
            return { ...p, table_ref: b.table_ref, seat_ref: b.seat_ref }
          }
          if (p.id === personBId) {
            return { ...p, table_ref: a.table_ref, seat_ref: a.seat_ref }
          }
          return p
        })
      })
    } catch (err: any) {
      toast.error(err.message ?? te("placeFailed"))
    }
  }

  // ── Auto-place all unassigned guests ─────────────────────────

  async function handleAutoPlace() {
    if (unassigned.length === 0 || allEmptySeats.length === 0) return
    setAutoPlacing(true)

    const toPlace = unassigned.slice(0, allEmptySeats.length)
    const updates: Person[] = []

    for (let i = 0; i < toPlace.length; i++) {
      const person = toPlace[i]
      const seat = allEmptySeats[i]
      try {
        await apiFetch(`/persons/${person.id}/seat`, {
          method: "PUT",
          body: JSON.stringify({ table_ref: seat.tableId, seat_ref: seat.seatRef }),
        })
        updates.push({ ...person, table_ref: seat.tableId, seat_ref: seat.seatRef, parked: false })
      } catch {
        // stop on first error
        break
      }
    }

    if (updates.length > 0) {
      const updatedIds = new Set(updates.map((u) => u.id))
      setPersons((prev) =>
        prev.map((p) => {
          const updated = updates.find((u) => u.id === p.id)
          return updated ?? p
        })
      )
      toast.success(`${updates.length} Gäste platziert`)
    }

    setAutoPlacing(false)
  }

  // ── Table generation ────────────────────────────────────────

  async function saveLayout(newLayout: FloorPlanLayout) {
    try {
      const fp = await apiFetch<FloorPlan>(`/events/${params.id}/floorplan`, {
        method: "PUT",
        body: JSON.stringify({ layout: newLayout, version: floorplanVersion }),
      })
      setLayout(newLayout)
      setFloorplanVersion(fp.version)
    } catch (err: any) {
      toast.error(err.message ?? te("saveFailed"))
      throw err
    }
  }

  function generateTables(count: number, seatsPerTable: number, startIndex: number): FloorPlanTable[] {
    const topSeats = Math.ceil(seatsPerTable / 2)
    const bottomSeats = Math.floor(seatsPerTable / 2)
    const cols = Math.min(count, 4)
    const newTables: FloorPlanTable[] = []

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      newTables.push({
        id: `table-${generateId()}`,
        label: `Tisch ${startIndex + i + 1}`,
        x: 200 + col * 450,
        y: 200 + row * 300,
        width: DEFAULT_TABLE_WIDTH,
        height: DEFAULT_TABLE_HEIGHT,
        rotation: 0,
        edges: {
          top: { seatCount: topSeats },
          right: { seatCount: 0 },
          bottom: { seatCount: bottomSeats },
          left: { seatCount: 0 },
        },
      })
    }
    return newTables
  }

  async function handleCreateTables(count: number, seatsPerTable: number) {
    const newTables = generateTables(count, seatsPerTable, 0)
    const newLayout: FloorPlanLayout = {
      tables: newTables,
      width: 2000,
      height: 1500,
    }
    await saveLayout(newLayout)
  }

  async function handleAddTable() {
    const currentTables = layout?.tables ?? []
    const existingSeats = currentTables.length > 0
      ? getTotalSeatCount(currentTables[currentTables.length - 1])
      : 8
    const topSeats = Math.ceil(existingSeats / 2)
    const bottomSeats = Math.floor(existingSeats / 2)
    const newTables = generateTables(1, topSeats + bottomSeats, currentTables.length)
    const newLayout: FloorPlanLayout = {
      ...layout!,
      tables: [...currentTables, ...newTables],
    }
    await saveLayout(newLayout)
  }

  // ── Click handlers (fallback for non-drag) ──────────────────

  function handleSeatClick(table: FloorPlanTable, seat: ComputedSeat) {
    if (activeDrag) return // ignore clicks during drag
    const key = `${table.id}:${seat.seatRef}`
    const person = seatPersonMap.get(key)
    if (person) {
      setUnseatPerson(person)
    } else {
      setAssignSeat({ table, seat })
      setAssignSearch("")
      setTimeout(() => searchRef.current?.focus(), 100)
    }
  }

  async function handleDialogAssign(personId: string) {
    if (!assignSeat) return
    setAssigning(true)
    try {
      await assignPerson(personId, assignSeat.table.id, assignSeat.seat.seatRef)
      setAssignSeat(null)
    } catch {
      // error already toasted in assignPerson
    } finally {
      setAssigning(false)
    }
  }

  async function handleUnseat() {
    if (!unseatPerson) return
    setUnseating(true)
    try {
      await apiFetch(`/persons/${unseatPerson.id}/park`, { method: "PUT" })
      setPersons((prev) =>
        prev.map((p) =>
          p.id === unseatPerson.id
            ? { ...p, table_ref: null, seat_ref: null, parked: true }
            : p
        )
      )
      setUnseatPerson(null)
    } catch (err: any) {
      toast.error(err.message ?? te("placeFailed"))
    } finally {
      setUnseating(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (tables.length === 0) {
    return <TableSetup onCreateTables={handleCreateTables} tf={tf} tc={tc} />
  }

  const isDragging = !!activeDrag

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="p-4 space-y-4" style={{ paddingBottom: panelOpen ? 200 : 80 }}>
        {/* Header stats */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t("seating")}</h2>
            <Badge variant="secondary" className="tabular-nums">
              {persons.length - unassigned.length}/{persons.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {unassigned.length > 0 && allEmptySeats.length > 0 && (
              <Button
                size="sm"
                onClick={handleAutoPlace}
                disabled={autoPlacing}
              >
                {autoPlacing ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <WandSparklesIcon className="size-4" />
                )}
                Alle platzieren
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddTable}
            >
              <PlusIcon className="size-4" />
              {tf("addTable")}
            </Button>
          </div>
        </div>

        {/* Table cards */}
        <div className="space-y-4">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              seatPersonMap={seatPersonMap}
              isDragging={isDragging}
              overSeatId={overSeatId}
              onSeatClick={(seat) => handleSeatClick(table, seat)}
            />
          ))}
        </div>
      </div>

      {/* Draggable unassigned guests panel */}
      <div className="fixed bottom-[72px] inset-x-0 z-30 bg-card border-t border-border safe-area-bottom">
        {/* Panel header */}
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-2.5"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <span className="text-sm font-semibold">
            {tg("notSeated")} ({unassigned.length})
          </span>
          <ChevronUpIcon
            className={`size-4 text-muted-foreground transition-transform ${
              panelOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Panel content */}
        {panelOpen && (
          <div className="px-4 pb-3 space-y-2">
            {unassigned.length > 3 && (
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={tg("searchPlaceholder")}
                  value={panelSearch}
                  onChange={(e) => setPanelSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
                {panelSearch && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    onClick={() => setPanelSearch("")}
                  >
                    <XIcon className="size-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            )}

            {filteredUnassigned.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                {unassigned.length === 0
                  ? "Alle Gäste sind platziert"
                  : tc("noResults")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
                {filteredUnassigned.map((person) => (
                  <DraggableGuest key={person.id} person={person} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDrag && (
          <div className="flex items-center justify-center rounded-lg bg-primary text-primary-foreground w-[44px] h-[44px] text-[11px] font-medium shadow-lg pointer-events-none">
            <span className="truncate max-w-[36px]">
              {activeDrag.person.name.split(" ")[0]}
            </span>
          </div>
        )}
      </DragOverlay>

      {/* Assign guest dialog (tap fallback) */}
      <Dialog
        open={!!assignSeat}
        onOpenChange={(open) => !open && setAssignSeat(null)}
      >
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {assignSeat
                ? `${tables.find((t) => t.id === assignSeat.table.id)?.label ?? ""} — Platz ${assignSeat.seat.label}`
                : ""}
            </DialogTitle>
            <DialogDescription>
              Wählen Sie einen Gast für diesen Platz
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder={tg("searchPlaceholder")}
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              className="pl-9"
            />
            {assignSearch && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setAssignSearch("")}
              >
                <XIcon className="size-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0">
            {dialogFilteredUnassigned.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {unassigned.length === 0
                  ? "Alle Gäste sind platziert"
                  : tc("noResults")}
              </p>
            ) : (
              <div className="divide-y">
                {dialogFilteredUnassigned.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    disabled={assigning}
                    className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-accent active:bg-accent disabled:opacity-50"
                    onClick={() => handleDialogAssign(person.id)}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <UserIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {person.name}
                      </p>
                      {person.booked_table && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1 py-0"
                        >
                          {person.booked_table}
                        </Badge>
                      )}
                    </div>
                    <UserPlusIcon className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unseat confirmation dialog */}
      <Dialog
        open={!!unseatPerson}
        onOpenChange={(open) => !open && setUnseatPerson(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{unseatPerson?.name}</DialogTitle>
            <DialogDescription>
              Platzierung aufheben?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setUnseatPerson(null)}
            >
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={unseating}
              onClick={handleUnseat}
            >
              {unseating && <Loader2Icon className="animate-spin" />}
              Entfernen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}

// ── DraggableGuest chip ───────────────────────────────────────

function DraggableGuest({ person }: { person: Person }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `person:${person.id}`,
    data: { type: "person", person } satisfies DragDataPerson,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium
        cursor-grab active:cursor-grabbing select-none touch-none
        ${isDragging ? "opacity-30" : "bg-background border-border"}
      `}
    >
      <span className="truncate max-w-[100px]">{person.name}</span>
      {person.booked_table && (
        <span className="text-[10px] text-muted-foreground">
          {person.booked_table}
        </span>
      )}
    </div>
  )
}

// ── TableCard component ───────────────────────────────────────

function TableCard({
  table,
  seatPersonMap,
  isDragging,
  overSeatId,
  onSeatClick,
}: {
  table: FloorPlanTable
  seatPersonMap: Map<string, Person>
  isDragging: boolean
  overSeatId: string | null
  onSeatClick: (seat: ComputedSeat) => void
}) {
  const seats = computeSeatsForTable(table)
  const totalSeats = getTotalSeatCount(table)

  const topSeats = seats.filter((s) => s.edge === "top")
  const bottomSeats = seats.filter((s) => s.edge === "bottom")
  const leftSeats = seats.filter((s) => s.edge === "left")
  const rightSeats = seats.filter((s) => s.edge === "right")

  const seatedPersons = seats
    .map((s) => ({
      seat: s,
      person: seatPersonMap.get(`${table.id}:${s.seatRef}`),
    }))
    .filter((x) => x.person) as { seat: ComputedSeat; person: Person }[]

  const occupiedCount = seatedPersons.length

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{table.label}</h3>
        <Badge
          variant={occupiedCount === totalSeats ? "default" : "secondary"}
          className="tabular-nums"
        >
          {occupiedCount}/{totalSeats}
        </Badge>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {topSeats.length > 0 && (
          <SeatRow
            seats={topSeats}
            tableId={table.id}
            seatPersonMap={seatPersonMap}
            isDragging={isDragging}
            overSeatId={overSeatId}
            onSeatClick={onSeatClick}
          />
        )}

        <div className="flex items-center gap-1.5">
          {leftSeats.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {leftSeats.map((seat) => (
                <DroppableSeat
                  key={seat.id}
                  seat={seat}
                  tableId={table.id}
                  seatPersonMap={seatPersonMap}
                  isDragging={isDragging}
                  isOver={overSeatId === `seat:${table.id}:${seat.seatRef}`}
                  onClick={() => onSeatClick(seat)}
                />
              ))}
            </div>
          )}

          <div className="h-10 rounded-lg bg-muted border border-border flex items-center justify-center min-w-[120px] flex-1 max-w-[300px]">
            <span className="text-xs text-muted-foreground font-medium">
              {table.label}
            </span>
          </div>

          {rightSeats.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {rightSeats.map((seat) => (
                <DroppableSeat
                  key={seat.id}
                  seat={seat}
                  tableId={table.id}
                  seatPersonMap={seatPersonMap}
                  isDragging={isDragging}
                  isOver={overSeatId === `seat:${table.id}:${seat.seatRef}`}
                  onClick={() => onSeatClick(seat)}
                />
              ))}
            </div>
          )}
        </div>

        {bottomSeats.length > 0 && (
          <SeatRow
            seats={bottomSeats}
            tableId={table.id}
            seatPersonMap={seatPersonMap}
            isDragging={isDragging}
            overSeatId={overSeatId}
            onSeatClick={onSeatClick}
          />
        )}
      </div>

      {/* Names list */}
      {occupiedCount > 0 && (
        <div className="border-t pt-2 space-y-0.5">
          {seatedPersons.map(({ seat, person }) => (
            <div key={seat.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{person.name}</span>
              <span className="ml-auto tabular-nums text-[10px] text-muted-foreground/60">{seat.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SeatRow ───────────────────────────────────────────────────

function SeatRow({
  seats,
  tableId,
  seatPersonMap,
  isDragging,
  overSeatId,
  onSeatClick,
}: {
  seats: ComputedSeat[]
  tableId: string
  seatPersonMap: Map<string, Person>
  isDragging: boolean
  overSeatId: string | null
  onSeatClick: (seat: ComputedSeat) => void
}) {
  return (
    <div className="flex gap-1.5 justify-center">
      {seats.map((seat) => (
        <DroppableSeat
          key={seat.id}
          seat={seat}
          tableId={tableId}
          seatPersonMap={seatPersonMap}
          isDragging={isDragging}
          isOver={overSeatId === `seat:${tableId}:${seat.seatRef}`}
          onClick={() => onSeatClick(seat)}
        />
      ))}
    </div>
  )
}

// ── DroppableSeat ─────────────────────────────────────────────

function DroppableSeat({
  seat,
  tableId,
  seatPersonMap,
  isDragging,
  isOver,
  onClick,
}: {
  seat: ComputedSeat
  tableId: string
  seatPersonMap: Map<string, Person>
  isDragging: boolean
  isOver: boolean
  onClick: () => void
}) {
  const seatId = `seat:${tableId}:${seat.seatRef}`
  const key = `${tableId}:${seat.seatRef}`
  const person = seatPersonMap.get(key)
  const isOccupied = !!person

  const { setNodeRef: setDropRef, isOver: dndIsOver } = useDroppable({
    id: seatId,
  })

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging: isSeatDragging,
  } = useDraggable({
    id: `seated:${tableId}:${seat.seatRef}`,
    data: {
      type: "seated-person",
      person: person!,
      fromTableId: tableId,
      fromSeatRef: seat.seatRef,
    } satisfies DragDataSeat,
    disabled: !isOccupied,
  })

  const isDropTarget = isOver || dndIsOver
  const showDropHighlight = isDragging && !isOccupied && isDropTarget
  const showSwapHighlight = isDragging && isOccupied && isDropTarget

  return (
    <div
      ref={(node) => {
        setDropRef(node)
        setDragRef(node)
      }}
      {...(isOccupied ? { ...listeners, ...attributes } : {})}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className={`
        relative flex items-center justify-center rounded-lg border text-xs font-medium
        transition-all w-[44px] h-[44px] select-none
        ${isOccupied ? "cursor-grab active:cursor-grabbing touch-none" : "cursor-pointer"}
        ${isSeatDragging ? "opacity-30" : ""}
        ${
          showDropHighlight
            ? "bg-primary/20 border-primary border-solid ring-2 ring-primary/30"
            : showSwapHighlight
              ? "bg-amber-100 border-amber-400 border-solid ring-2 ring-amber-300/50"
              : isOccupied
                ? "bg-primary/10 border-primary/30 text-foreground"
                : isDragging
                  ? "bg-background border-dashed border-primary/30 text-muted-foreground"
                  : "bg-background border-dashed border-border text-muted-foreground hover:bg-accent hover:border-primary/40"
        }
      `}
      title={person?.name ?? `Platz ${seat.label}`}
    >
      {isOccupied ? (
        <span className="truncate max-w-[36px] text-[11px]">
          {person.name.split(" ")[0]}
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground/60">
          {seat.label}
        </span>
      )}
    </div>
  )
}

// ── TableSetup (empty state) ─────────────────────────────────

function TableSetup({
  onCreateTables,
  tf,
  tc,
}: {
  onCreateTables: (count: number, seatsPerTable: number) => Promise<void>
  tf: (key: string) => string
  tc: (key: string) => string
}) {
  const [tableCount, setTableCount] = useState(5)
  const [seatsPerTable, setSeatsPerTable] = useState(8)
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    setCreating(true)
    try {
      await onCreateTables(tableCount, seatsPerTable)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex items-center justify-center p-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{tf("title")}</CardTitle>
          <CardDescription>{tf("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{tf("tableCount")}</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                disabled={tableCount <= 1}
                onClick={() => setTableCount((v) => Math.max(1, v - 1))}
              >
                <MinusIcon className="size-4" />
              </Button>
              <Input
                type="number"
                min={1}
                max={50}
                value={tableCount}
                onChange={(e) => setTableCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="text-center text-lg font-semibold tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                disabled={tableCount >= 50}
                onClick={() => setTableCount((v) => Math.min(50, v + 1))}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{tf("seatsPerTable")}</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                disabled={seatsPerTable <= 2}
                onClick={() => setSeatsPerTable((v) => Math.max(2, v - 1))}
              >
                <MinusIcon className="size-4" />
              </Button>
              <Input
                type="number"
                min={2}
                max={20}
                value={seatsPerTable}
                onChange={(e) => setSeatsPerTable(Math.max(2, Math.min(20, Number(e.target.value) || 2)))}
                className="text-center text-lg font-semibold tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                disabled={seatsPerTable >= 20}
                onClick={() => setSeatsPerTable((v) => Math.min(20, v + 1))}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </div>

          <div className="pt-2 text-center text-sm text-muted-foreground">
            {tableCount} &times; {seatsPerTable} = {tableCount * seatsPerTable} {tc("seats")}
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={creating}
            onClick={handleCreate}
          >
            {creating && <Loader2Icon className="size-4 animate-spin" />}
            {tf("create")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
