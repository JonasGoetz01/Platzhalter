"use client"

import { useRef, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import type Konva from "konva"
import type { FloorPlanTable, EdgeId } from "@/lib/types"
import { SEAT_OFFSET } from "@/lib/floorplan"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MinusIcon, PlusIcon } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

interface EdgeSelectorProps {
  table: FloorPlanTable
  stageRef: React.RefObject<Konva.Stage | null>
  scale: number
  position: { x: number; y: number }
  onEdgeChange: (tableId: string, edge: EdgeId, seatCount: number) => void
}

interface EdgeButtonPos {
  edge: EdgeId
  left: number
  top: number
  width: number
  height: number
}

function getEdgePositions(
  table: FloorPlanTable,
  stageRef: React.RefObject<Konva.Stage | null>,
  scale: number,
  position: { x: number; y: number }
): EdgeButtonPos[] {
  const stage = stageRef.current
  if (!stage) return []

  const cx = table.x * scale + position.x
  const cy = table.y * scale + position.y
  const hw = (table.width / 2) * scale
  const hh = (table.height / 2) * scale

  const btnThickness = 44
  const halfThick = btnThickness / 2

  const rad = (table.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  function rotateAndPosition(
    localX: number,
    localY: number,
    isHorizontal: boolean
  ): { left: number; top: number; width: number; height: number } {
    const rx = localX * cos - localY * sin
    const ry = localX * sin + localY * cos

    if (isHorizontal) {
      return {
        left: cx + rx - hw,
        top: cy + ry - halfThick,
        width: hw * 2,
        height: btnThickness,
      }
    }
    return {
      left: cx + rx - halfThick,
      top: cy + ry - hh,
      width: btnThickness,
      height: hh * 2,
    }
  }

  return [
    { edge: "top" as EdgeId, ...rotateAndPosition(0, -hh - halfThick, true) },
    { edge: "bottom" as EdgeId, ...rotateAndPosition(0, hh + halfThick, true) },
    { edge: "left" as EdgeId, ...rotateAndPosition(-hw - halfThick, 0, false) },
    { edge: "right" as EdgeId, ...rotateAndPosition(hw + halfThick, 0, false) },
  ]
}

function EdgeButton({
  pos,
  table,
  onEdgeChange,
}: {
  pos: EdgeButtonPos
  table: FloorPlanTable
  onEdgeChange: (tableId: string, edge: EdgeId, seatCount: number) => void
}) {
  const t = useTranslations("floorplan.edge")
  const isMobile = useIsMobile()
  const currentCount = table.edges[pos.edge].seatCount
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(currentCount))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(String(currentCount))
  }, [currentCount])

  useEffect(() => {
    if (open && !isMobile) {
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [open, isMobile])

  function handleSubmit() {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0 && num <= 20) {
      onEdgeChange(table.id, pos.edge, num)
    }
    setOpen(false)
  }

  function handleStep(delta: number) {
    const num = parseInt(value, 10)
    const next = Math.max(0, Math.min(20, (isNaN(num) ? 0 : num) + delta))
    setValue(String(next))
    onEdgeChange(table.id, pos.edge, next)
  }

  const hasSeats = currentCount > 0
  const edgeLabel = t(pos.edge)

  const trigger = (
    <button
      type="button"
      className="absolute z-10 flex items-center justify-center rounded-sm transition-colors active:bg-[rgba(200,169,110,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a96e]"
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.width,
        height: pos.height,
        border: hasSeats ? "2px solid rgba(200, 169, 110, 0.5)" : "2px dashed rgba(200, 169, 110, 0.2)",
        background: hasSeats ? "rgba(200, 169, 110, 0.1)" : "transparent",
      }}
      aria-label={t("edgeLabel", { edge: edgeLabel, count: currentCount })}
      onClick={() => setOpen(true)}
    >
      {hasSeats && (
        <span className="text-[10px] font-medium text-[#c8a96e]">
          {currentCount}
        </span>
      )}
    </button>
  )

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)]">
            <SheetHeader>
              <SheetTitle>{edgeLabel} — {t("seats")}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col items-center gap-4 p-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-14 min-h-11 min-w-11"
                  onClick={() => handleStep(-1)}
                  disabled={parseInt(value, 10) <= 0}
                >
                  <MinusIcon className="size-6" />
                  <span className="sr-only">{t("less")}</span>
                </Button>
                <Input
                  ref={inputRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  max={20}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
                  className="h-14 w-20 text-center text-2xl"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-14 min-h-11 min-w-11"
                  onClick={() => handleStep(1)}
                  disabled={parseInt(value, 10) >= 20}
                >
                  <PlusIcon className="size-6" />
                  <span className="sr-only">{t("more")}</span>
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">{t("seats")}</span>
              <Button
                className="min-h-14 w-full text-lg font-semibold"
                onClick={handleSubmit}
              >
                {t("apply")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="absolute z-10 flex items-center justify-center rounded-sm transition-colors active:bg-[rgba(200,169,110,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a96e]"
        style={{
          left: pos.left,
          top: pos.top,
          width: pos.width,
          height: pos.height,
          border: hasSeats ? "2px solid rgba(200, 169, 110, 0.5)" : "2px dashed rgba(200, 169, 110, 0.2)",
          background: hasSeats ? "rgba(200, 169, 110, 0.1)" : "transparent",
        }}
        aria-label={t("edgeLabel", { edge: edgeLabel, count: currentCount })}
      >
        {hasSeats && (
          <span className="text-[10px] font-medium text-[#c8a96e]">
            {currentCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={pos.edge === "top" ? "top" : pos.edge === "bottom" ? "bottom" : pos.edge === "left" ? "left" : "right"}
        className="w-48 p-3"
        align="center"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">{edgeLabel}</p>
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              max={20}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
              className="h-11 w-16 text-center text-sm"
            />
            <span className="text-sm text-muted-foreground">{t("seats")}</span>
            <Button className="min-h-14 min-w-14 px-6" onClick={handleSubmit}>
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function EdgeSelector({
  table,
  stageRef,
  scale,
  position,
  onEdgeChange,
}: EdgeSelectorProps) {
  const positions = getEdgePositions(table, stageRef, scale, position)

  if (positions.length === 0) return null

  return (
    <>
      {positions.map((pos) => (
        <EdgeButton
          key={pos.edge}
          pos={pos}
          table={table}
          onEdgeChange={onEdgeChange}
        />
      ))}
    </>
  )
}
