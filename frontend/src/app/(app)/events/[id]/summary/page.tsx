"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import {
  FileDownIcon,
  Loader2Icon,
  UsersIcon,
  ArmchairIcon,
  CircleOffIcon,
  Grid2x2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import {
  migrateLayout,
  computeSeatsForTable,
  getTotalSeatCount,
} from "@/lib/floorplan"
import { toast } from "sonner"
import type {
  FloorPlan,
  FloorPlanLayout,
  Event,
  Person,
  ComputedSeat,
} from "@/lib/types"

export default function SummaryPage() {
  const t = useTranslations("events")
  const te = useTranslations("errors")
  const locale = useLocale()
  const params = useParams<{ id: string }>()

  const [event, setEvent] = useState<Event | null>(null)
  const [persons, setPersons] = useState<Person[]>([])
  const [layout, setLayout] = useState<FloorPlanLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [e, p] = await Promise.all([
        apiFetch<Event>(`/events/${params.id}`),
        apiFetch<Person[]>(`/events/${params.id}/persons`).catch(() => []),
      ])
      setEvent(e)
      setPersons(p ?? [])

      try {
        const fp = await apiFetch<FloorPlan>(
          `/events/${params.id}/floorplan`
        )
        setLayout(migrateLayout((fp.layout as any) ?? { tables: [], width: 1200, height: 800 }))
      } catch {
        setLayout({ tables: [], shapes: [], width: 1200, height: 800 })
      }
    } catch {
      toast.error(te("eventLoadFailed"))
    } finally {
      setLoading(false)
    }
  }, [params.id, te])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Build a lookup: "tableId:seatRef" -> Person
  const personByTableSeat = useMemo(() => {
    const map = new Map<string, Person>()
    for (const p of persons) {
      if (p.table_ref && p.seat_ref) {
        map.set(`${p.table_ref}:${p.seat_ref}`, p)
      }
    }
    return map
  }, [persons])

  // Compute seats per table
  const tableSeatsMap = useMemo(() => {
    if (!layout) return new Map<string, ComputedSeat[]>()
    const map = new Map<string, ComputedSeat[]>()
    for (const table of layout.tables) {
      map.set(table.id, computeSeatsForTable(table))
    }
    return map
  }, [layout])

  // Stats
  const seatedCount = useMemo(
    () => persons.filter((p) => p.table_ref && p.seat_ref).length,
    [persons]
  )
  const unassignedPersons = useMemo(
    () => persons.filter((p) => !p.table_ref || !p.seat_ref),
    [persons]
  )
  const totalTables = layout?.tables.length ?? 0

  async function handleExportPDF() {
    if (!event || !layout) return
    setExporting(true)
    try {
      const { generateSeatingPDF } = await import(
        "@/components/floorplan/pdf-export"
      )
      const blob = await generateSeatingPDF(event, layout, persons)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${event.name.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, "")}_Sitzplan.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(t("pdfExported"))
    } catch {
      toast.error(te("pdfExportFailed"))
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {event?.name}
        </h1>
        {event?.event_date && (
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(event.event_date).toLocaleDateString(locale, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<UsersIcon className="size-4 text-muted-foreground" />}
          value={persons.length}
          label={t("totalGuests")}
        />
        <StatCard
          icon={<ArmchairIcon className="size-4 text-green-600 dark:text-green-400" />}
          value={seatedCount}
          label={t("seated")}
        />
        <StatCard
          icon={<CircleOffIcon className="size-4 text-amber-600 dark:text-amber-400" />}
          value={unassignedPersons.length}
          label={t("notSeated")}
        />
        <StatCard
          icon={<Grid2x2Icon className="size-4 text-muted-foreground" />}
          value={totalTables}
          label="Tische"
        />
      </div>

      {/* Table-by-table breakdown */}
      {layout && layout.tables.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Tischübersicht
          </h2>
          {layout.tables.map((table) => {
            const seats = tableSeatsMap.get(table.id) ?? []
            const totalSeats = getTotalSeatCount(table)
            const occupiedCount = seats.filter((s) =>
              personByTableSeat.has(`${table.id}:${s.seatRef}`)
            ).length

            return (
              <Card key={table.id} size="sm">
                <CardContent className="p-0">
                  {/* Table header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {table.label}
                      </span>
                      <Badge variant="secondary">
                        {occupiedCount}/{totalSeats}
                      </Badge>
                    </div>
                  </div>

                  {/* Seat list */}
                  <div className="divide-y divide-border/30">
                    {seats.map((seat) => {
                      const person = personByTableSeat.get(
                        `${table.id}:${seat.seatRef}`
                      )

                      return (
                        <div
                          key={seat.id}
                          className="flex items-center gap-3 px-4 py-2"
                        >
                          <span className="w-8 text-xs text-muted-foreground tabular-nums text-right shrink-0">
                            {seat.label}
                          </span>
                          {person ? (
                            <span className="text-sm truncate">
                              {person.name}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/50 italic">
                              — frei —
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Unassigned guests section */}
      {unassignedPersons.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {t("notSeated")} ({unassignedPersons.length})
          </h2>
          <Card size="sm">
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {unassignedPersons.map((person) => (
                  <div
                    key={person.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-sm"
                  >
                    {person.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {persons.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          Noch keine Gäste vorhanden.
        </div>
      )}

      {/* Fixed PDF export button at bottom */}
      <div className="fixed bottom-16 inset-x-0 z-40 p-3 safe-area-bottom">
        <div className="mx-auto max-w-lg">
          <Button
            size="lg"
            className="w-full shadow-lg"
            onClick={handleExportPDF}
            disabled={exporting || !event || !layout}
          >
            {exporting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <FileDownIcon className="size-4" />
            )}
            {t("pdfExport")}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Stat card component ──────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums leading-none">
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
