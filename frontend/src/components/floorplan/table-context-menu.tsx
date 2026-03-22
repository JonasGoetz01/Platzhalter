"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RotateCwIcon, Trash2Icon } from "lucide-react"
import type { FloorPlanTable } from "@/lib/types"
import { getTotalSeatCount } from "@/lib/floorplan"

interface TableContextMenuProps {
  table: FloorPlanTable | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRename: (label: string) => void
  onResize: (width: number, height: number) => void
  onRotate: () => void
  onDelete: () => void
}

export function TableContextMenu({
  table,
  open,
  onOpenChange,
  onRename,
  onResize,
  onRotate,
  onDelete,
}: TableContextMenuProps) {
  const t = useTranslations("floorplan.contextMenu")
  const [label, setLabel] = useState("")
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")

  useEffect(() => {
    if (table) {
      setLabel(table.label)
      setWidth(String(table.width))
      setHeight(String(table.height))
    }
  }, [table])

  if (!table) return null

  const totalSeats = getTotalSeatCount(table)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>{t("editTable")}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <Input
            placeholder={t("tableName")}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              onRename(e.target.value)
            }}
            className="min-h-11 text-base"
          />

          <div className="flex gap-3">
            <label className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">{t("width")}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={60}
                max={600}
                step={10}
                value={width}
                onChange={(e) => {
                  setWidth(e.target.value)
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v)) onResize(v, table.height)
                }}
                className="min-h-11 text-center"
              />
            </label>
            <label className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">{t("height")}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={30}
                max={400}
                step={10}
                value={height}
                onChange={(e) => {
                  setHeight(e.target.value)
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v)) onResize(table.width, v)
                }}
                className="min-h-11 text-center"
              />
            </label>
          </div>

          <p className="text-sm text-muted-foreground">
            {t("seats", { count: totalSeats })}
          </p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="min-h-14 flex-1 text-base"
              onClick={() => {
                onRotate()
                onOpenChange(false)
              }}
            >
              <RotateCwIcon className="size-5" />
              {t("rotate")}
            </Button>
            <Button
              variant="destructive"
              className="min-h-14 flex-1 text-base"
              onClick={() => {
                onDelete()
                onOpenChange(false)
              }}
            >
              <Trash2Icon className="size-5" />
              {t("delete")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
