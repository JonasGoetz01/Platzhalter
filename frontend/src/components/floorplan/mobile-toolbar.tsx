"use client"

import {
  Undo2Icon,
  Redo2Icon,
  PlusIcon,
  Trash2Icon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

interface MobileToolbarProps {
  canUndo: boolean
  canRedo: boolean
  hasSelected: boolean
  scale: number
  onUndo: () => void
  onRedo: () => void
  onAddTable: () => void
  onDeleteSelected: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToView: () => void
}

export function MobileToolbar({
  canUndo,
  canRedo,
  hasSelected,
  scale,
  onUndo,
  onRedo,
  onAddTable,
  onDeleteSelected,
  onZoomIn,
  onZoomOut,
  onFitToView,
}: MobileToolbarProps) {
  const t = useTranslations("floorplan.toolbar")

  return (
    <div
      className="flex min-h-14 items-center justify-around border-t bg-background/95 px-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        onClick={onUndo}
        disabled={!canUndo}
      >
        <Undo2Icon className="size-5" />
        <span className="sr-only">{t("undo")}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        onClick={onRedo}
        disabled={!canRedo}
      >
        <Redo2Icon className="size-5" />
        <span className="sr-only">{t("redo")}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        onClick={onAddTable}
      >
        <PlusIcon className="size-5" />
        <span className="sr-only">{t("addTable")}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11 text-destructive"
        onClick={onDeleteSelected}
        disabled={!hasSelected}
      >
        <Trash2Icon className="size-5" />
        <span className="sr-only">{t("delete")}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        onClick={onZoomOut}
      >
        <ZoomOutIcon className="size-5" />
        <span className="sr-only">{t("zoomOut")}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        onClick={onZoomIn}
      >
        <ZoomInIcon className="size-5" />
        <span className="sr-only">{t("zoomIn")}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        onClick={onFitToView}
      >
        <MaximizeIcon className="size-5" />
        <span className="sr-only">{t("fitToView")}</span>
      </Button>
    </div>
  )
}
