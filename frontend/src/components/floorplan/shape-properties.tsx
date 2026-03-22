"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import type { FloorPlanShape } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { PaletteIcon } from "lucide-react"

interface ShapePropertiesProps {
  shape: FloorPlanShape
  onUpdate: (id: string, updates: Partial<FloorPlanShape>) => void
}

const PRESET_COLORS = [
  "rgba(200, 169, 110, 0.3)",
  "rgba(200, 169, 110, 0.15)",
  "rgba(232, 228, 220, 0.1)",
  "rgba(232, 228, 220, 0.05)",
  "rgba(100, 100, 100, 0.2)",
  "transparent",
]

const PRESET_STROKES = [
  "rgba(200, 169, 110, 0.5)",
  "rgba(200, 169, 110, 0.3)",
  "rgba(232, 228, 220, 0.2)",
  "rgba(232, 228, 220, 0.1)",
  "rgba(100, 100, 100, 0.3)",
  "transparent",
]

export function ShapeProperties({ shape, onUpdate }: ShapePropertiesProps) {
  const t = useTranslations("floorplan.properties")
  const [opacity, setOpacity] = useState(String(Math.round(shape.opacity * 100)))
  const [strokeWidth, setStrokeWidth] = useState(String(shape.strokeWidth))

  useEffect(() => {
    setOpacity(String(Math.round(shape.opacity * 100)))
    setStrokeWidth(String(shape.strokeWidth))
  }, [shape.opacity, shape.strokeWidth])

  return (
    <Popover>
      <PopoverTrigger
        className="flex min-h-11 min-w-11 items-center justify-center rounded-md border bg-background/90 shadow-sm transition-colors active:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PaletteIcon className="size-4" />
        <span className="sr-only">{t("title")}</span>
      </PopoverTrigger>
      <PopoverContent side="right" className="w-56 p-3">
        <div className="space-y-3">
          {/* Fill */}
          <div>
            <p className="mb-1.5 text-xs font-medium">{t("fill")}</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="size-8 min-h-11 min-w-11 rounded border border-border p-1.5 transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    background: color === "transparent" ? "repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50% / 8px 8px" : color,
                    outline: shape.fill === color ? "2px solid rgba(200, 169, 110, 0.8)" : "none",
                    outlineOffset: 1,
                  }}
                  onClick={() => onUpdate(shape.id, { fill: color })}
                />
              ))}
            </div>
          </div>

          {/* Stroke */}
          <div>
            <p className="mb-1.5 text-xs font-medium">{t("stroke")}</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_STROKES.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="size-8 min-h-11 min-w-11 rounded border border-border p-1.5 transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    background: color === "transparent" ? "repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50% / 8px 8px" : color,
                    outline: shape.stroke === color ? "2px solid rgba(200, 169, 110, 0.8)" : "none",
                    outlineOffset: 1,
                  }}
                  onClick={() => onUpdate(shape.id, { stroke: color })}
                />
              ))}
            </div>
          </div>

          {/* Stroke width */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">{t("strokeWidth")}</label>
            <Input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={strokeWidth}
              onChange={(e) => {
                setStrokeWidth(e.target.value)
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) onUpdate(shape.id, { strokeWidth: v })
              }}
              className="min-h-11 w-16 text-xs text-center"
            />
          </div>

          {/* Opacity */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">{t("opacity")}</label>
            <Input
              type="number"
              min={0}
              max={100}
              step={5}
              value={opacity}
              onChange={(e) => {
                setOpacity(e.target.value)
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v)) onUpdate(shape.id, { opacity: v / 100 })
              }}
              className="min-h-11 w-16 text-xs text-center"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
