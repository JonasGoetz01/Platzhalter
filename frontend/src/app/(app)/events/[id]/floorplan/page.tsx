"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { ArrowLeftIcon, Loader2Icon, SaveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { migrateLayout } from "@/lib/floorplan"
import { useRequireRole } from "@/hooks/use-require-role"
import { toast } from "sonner"
import type { FloorPlan, FloorPlanLayout, Event } from "@/lib/types"

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

const EMPTY_LAYOUT: FloorPlanLayout = { tables: [], shapes: [], width: 1200, height: 800 }

export default function FloorPlanPage() {
  const t = useTranslations("events")
  const te = useTranslations("errors")
  const tc = useTranslations("common")
  const params = useParams<{ id: string }>()
  const { loading: authLoading, allowed } = useRequireRole(["admin"])
  const [event, setEvent] = useState<Event | null>(null)
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null)
  const [layout, setLayout] = useState<FloorPlanLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const e = await apiFetch<Event>(`/events/${params.id}`)
      setEvent(e)

      try {
        const fp = await apiFetch<FloorPlan>(`/events/${params.id}/floorplan`)
        setFloorPlan(fp)
        const migrated = migrateLayout(fp.layout as any ?? { ...EMPTY_LAYOUT })
        setLayout(migrated)
      } catch {
        setFloorPlan(null)
        setLayout({ ...EMPTY_LAYOUT })
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

  async function handleSave() {
    if (!layout) return
    setSaving(true)

    try {
      const updated = await apiFetch<FloorPlan>(
        `/events/${params.id}/floorplan`,
        {
          method: "PUT",
          body: JSON.stringify({
            layout,
            version: floorPlan?.version ?? 0,
          }),
        }
      )
      setFloorPlan(updated)
      setLayout(migrateLayout(updated.layout as any ?? layout))
      toast.success(t("floorplanSaved"))
    } catch (err: any) {
      if (err.code === "VERSION_CONFLICT") {
        const confirmed = window.confirm(
          "The floorplan was modified by another user. Reload to get the latest version? Unsaved changes will be lost."
        )
        if (confirmed) {
          fetchData()
        }
      } else {
        toast.error(err.message ?? te("saveFailed"))
      }
    } finally {
      setSaving(false)
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
    <div className="flex h-[calc(100svh-3.5rem)] flex-col -m-4 md:-m-6">
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
        <span className="text-sm text-muted-foreground">— {t("floorplan")}</span>
        <div className="flex-1" />
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <SaveIcon />
          )}
          {tc("save")}
        </Button>
      </div>

      {/* Editor */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {layout && (
            <FloorPlanEditor
              mode="edit"
              layout={layout}
              persons={[]}
              onLayoutChange={setLayout}
              onPersonUpdate={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  )
}
