import { Rect, Circle, Line } from "react-konva"
import type Konva from "konva"
import type { FloorPlanShape } from "@/lib/types"

interface ShapeRendererProps {
  shape: FloorPlanShape
  selected: boolean
  draggable: boolean
  onSelect: () => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void
}

export function ShapeRenderer({
  shape,
  selected,
  draggable,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: ShapeRendererProps) {
  const common = {
    id: `shape-${shape.id}`,
    name: "floorplan-shape",
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation,
    fill: shape.fill,
    stroke: selected ? "rgba(200, 169, 110, 0.9)" : shape.stroke,
    strokeWidth: selected ? shape.strokeWidth + 1 : shape.strokeWidth,
    opacity: shape.opacity,
    draggable,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd,
    onTransformEnd,
  }

  switch (shape.type) {
    case "rectangle":
      return (
        <Rect
          {...common}
          width={shape.width ?? 100}
          height={shape.height ?? 60}
          offsetX={(shape.width ?? 100) / 2}
          offsetY={(shape.height ?? 60) / 2}
          cornerRadius={2}
        />
      )
    case "circle":
      return <Circle {...common} radius={shape.radius ?? 40} />
    case "line":
      return (
        <Line
          {...common}
          points={shape.points ?? [0, 0, 100, 0]}
          fill={undefined}
          hitStrokeWidth={20}
        />
      )
    case "polygon":
      return (
        <Line
          {...common}
          points={shape.points ?? [0, -40, 40, 20, -40, 20]}
          closed
          hitStrokeWidth={10}
        />
      )
  }
}
