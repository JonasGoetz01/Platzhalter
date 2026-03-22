"use client"

import {
  PlusIcon,
  Trash2Icon,
  RotateCwIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  Undo2Icon,
  Redo2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FloorPlanTable } from "@/lib/types"
import { getTotalSeatCount, MIN_SCALE, MAX_SCALE } from "@/lib/floorplan"

interface ToolbarProps {
  isEditMode: boolean
  selectedTable: FloorPlanTable | null
  scale: number
  canUndo: boolean
  canRedo: boolean
  onAddTable: () => void
  onDeleteSelected: () => void
  onRotateSelected: () => void
  onRenameTable: (label: string) => void
  onResizeTable: (width: number, height: number) => void
  onUndo: () => void
  onRedo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToView: () => void
}

export function Toolbar({
  isEditMode,
  selectedTable,
  scale,
  canUndo,
  canRedo,
  onAddTable,
  onDeleteSelected,
  onRotateSelected,
  onRenameTable,
  onResizeTable,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitToView,
}: ToolbarProps) {
  const t = useTranslations("floorplan.toolbar")
  const totalSeats = selectedTable ? getTotalSeatCount(selectedTable) : 0

  return (
    <div className="flex min-h-11 md:h-10 shrink-0 items-center gap-2 border-b bg-background/80 px-3 flex-wrap">
      {isEditMode && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={onUndo}
            disabled={!canUndo}
          >
            <Undo2Icon className="size-4" />
            <span className="sr-only">{t("undo")}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={onRedo}
            disabled={!canRedo}
          >
            <Redo2Icon className="size-4" />
            <span className="sr-only">{t("redo")}</span>
          </Button>

          <div className="mx-2 h-4 w-px bg-border" />

          <Button variant="outline" size="sm" className="min-h-11" onClick={onAddTable}>
            <PlusIcon className="size-4" /> {t("addTable")}
          </Button>

          <div className="mx-2 h-4 w-px bg-border" />

          <Input
            placeholder={selectedTable ? t("tableName") : t("noSelection")}
            value={selectedTable?.label ?? ""}
            onChange={(e) => onRenameTable(e.target.value)}
            disabled={!selectedTable}
            className="min-h-11 w-28 text-xs px-2"
          />

          <div className="mx-2 h-4 w-px bg-border" />

          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            {t("width")}
            <Input
              type="number"
              min={60}
              max={600}
              step={10}
              value={selectedTable?.width ?? ""}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && selectedTable)
                  onResizeTable(v, selectedTable.height)
              }}
              disabled={!selectedTable}
              className="min-h-11 w-16 text-xs px-1 text-center"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            {t("height")}
            <Input
              type="number"
              min={30}
              max={400}
              step={10}
              value={selectedTable?.height ?? ""}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && selectedTable)
                  onResizeTable(selectedTable.width, v)
              }}
              disabled={!selectedTable}
              className="min-h-11 w-16 text-xs px-1 text-center"
            />
          </label>

          <div className="mx-2 h-4 w-px bg-border" />

          <span className="w-14 text-center text-xs text-muted-foreground tabular-nums">
            {selectedTable ? t("seats", { count: totalSeats }) : t("noSelection")}
          </span>

          <div className="mx-2 h-4 w-px bg-border" />

          <Button
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={onRotateSelected}
            disabled={!selectedTable}
          >
            <RotateCwIcon className="size-4" />
            <span className="sr-only">{t("rotate")}</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11 text-destructive"
            onClick={onDeleteSelected}
            disabled={!selectedTable}
          >
            <Trash2Icon className="size-4" />
            <span className="sr-only">{t("delete")}</span>
          </Button>
        </>
      )}

      <div className="flex-1" />

      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onZoomOut}>
        <ZoomOutIcon className="size-4" />
        <span className="sr-only">{t("zoomOut")}</span>
      </Button>
      <span className="w-12 text-center text-xs text-muted-foreground">
        {Math.round(scale * 100)}%
      </span>
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onZoomIn}>
        <ZoomInIcon className="size-4" />
        <span className="sr-only">{t("zoomIn")}</span>
      </Button>
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onFitToView}>
        <MaximizeIcon className="size-4" />
        <span className="sr-only">{t("fitToView")}</span>
      </Button>
    </div>
  )
}
