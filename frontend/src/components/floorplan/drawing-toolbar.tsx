"use client"

import {
  MousePointerIcon,
  SquareIcon,
  CircleIcon,
  MinusIcon,
  PentagonIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ToolMode =
  | "pointer"
  | "draw-rectangle"
  | "draw-circle"
  | "draw-line"
  | "draw-polygon"

interface DrawingToolbarProps {
  toolMode: ToolMode
  onToolModeChange: (mode: ToolMode) => void
  hasSelectedShape: boolean
  onDeleteShape: () => void
}

const tools: { mode: ToolMode; icon: typeof MousePointerIcon; labelKey: string }[] = [
  { mode: "pointer", icon: MousePointerIcon, labelKey: "pointer" },
  { mode: "draw-rectangle", icon: SquareIcon, labelKey: "rectangle" },
  { mode: "draw-circle", icon: CircleIcon, labelKey: "circle" },
  { mode: "draw-line", icon: MinusIcon, labelKey: "line" },
  { mode: "draw-polygon", icon: PentagonIcon, labelKey: "polygon" },
]

export function DrawingToolbar({
  toolMode,
  onToolModeChange,
  hasSelectedShape,
  onDeleteShape,
}: DrawingToolbarProps) {
  const t = useTranslations("floorplan.drawing")

  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-background/90 p-1.5 shadow-sm">
      {tools.map(({ mode, icon: Icon, labelKey }) => (
        <Button
          key={mode}
          variant="ghost"
          size="icon"
          className={cn(
            "min-h-11 min-w-11 flex flex-col gap-0.5",
            toolMode === mode && "bg-primary/10 text-primary"
          )}
          onClick={() => onToolModeChange(mode)}
        >
          <Icon className="size-4" />
          <span className="text-[10px] md:sr-only">{t(labelKey)}</span>
        </Button>
      ))}
      {hasSelectedShape && (
        <>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 flex flex-col gap-0.5 text-destructive"
            onClick={onDeleteShape}
          >
            <Trash2Icon className="size-4" />
            <span className="text-[10px] md:sr-only">{t("deleteShape")}</span>
          </Button>
        </>
      )}
    </div>
  )
}
