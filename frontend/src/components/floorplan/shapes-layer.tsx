import { useRef, useEffect } from "react"
import { Layer, Transformer } from "react-konva"
import type Konva from "konva"
import type { FloorPlanShape } from "@/lib/types"
import { ShapeRenderer } from "./shape-renderer"

interface ShapesLayerProps {
  shapes: FloorPlanShape[]
  selectedShapeId: string | null
  isEditMode: boolean
  onSelectShape: (id: string | null) => void
  onShapeDragEnd: (id: string, x: number, y: number) => void
  onShapeTransformEnd: (id: string, updates: Partial<FloorPlanShape>) => void
}

export function ShapesLayer({
  shapes,
  selectedShapeId,
  isEditMode,
  onSelectShape,
  onShapeDragEnd,
  onShapeTransformEnd,
}: ShapesLayerProps) {
  const transformerRef = useRef<Konva.Transformer>(null)
  const layerRef = useRef<Konva.Layer>(null)

  useEffect(() => {
    const tr = transformerRef.current
    if (!tr || !layerRef.current) return

    if (selectedShapeId && isEditMode) {
      const node = layerRef.current.findOne(`#shape-${selectedShapeId}`)
      if (node) {
        tr.nodes([node])
        tr.getLayer()?.batchDraw()
        return
      }
    }
    tr.nodes([])
    tr.getLayer()?.batchDraw()
  }, [selectedShapeId, isEditMode, shapes])

  function handleTransformEnd(shape: FloorPlanShape, e: Konva.KonvaEventObject<Event>) {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)

    const updates: Partial<FloorPlanShape> = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
    }

    if (shape.type === "rectangle") {
      updates.width = Math.max(10, (shape.width ?? 100) * scaleX)
      updates.height = Math.max(10, (shape.height ?? 60) * scaleY)
    } else if (shape.type === "circle") {
      updates.radius = Math.max(5, (shape.radius ?? 40) * Math.max(scaleX, scaleY))
    } else if (shape.type === "line" || shape.type === "polygon") {
      if (shape.points) {
        updates.points = shape.points.map((p, i) =>
          i % 2 === 0 ? p * scaleX : p * scaleY
        )
      }
    }

    onShapeTransformEnd(shape.id, updates)
  }

  return (
    <Layer ref={layerRef}>
      {shapes.map((shape) => (
        <ShapeRenderer
          key={shape.id}
          shape={shape}
          selected={shape.id === selectedShapeId}
          draggable={isEditMode}
          onSelect={() => isEditMode && onSelectShape(shape.id)}
          onDragEnd={(e) => onShapeDragEnd(shape.id, e.target.x(), e.target.y())}
          onTransformEnd={(e) => handleTransformEnd(shape, e)}
        />
      ))}
      {isEditMode && (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          enabledAnchors={[
            "top-left", "top-right", "bottom-left", "bottom-right",
            "middle-left", "middle-right", "top-center", "bottom-center",
          ]}
          borderStroke="rgba(200, 169, 110, 0.7)"
          anchorStroke="rgba(200, 169, 110, 0.9)"
          anchorFill="rgba(200, 169, 110, 0.3)"
          anchorSize={8}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) return oldBox
            return newBox
          }}
        />
      )}
    </Layer>
  )
}
