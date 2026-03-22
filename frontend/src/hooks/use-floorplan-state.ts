"use client"

import { useCallback } from "react"
import type {
  FloorPlanLayout,
  FloorPlanTable,
  FloorPlanShape,
  EdgeId,
} from "@/lib/types"
import {
  generateId,
  generateTableLabel,
  computeExpandLabel,
  GRID_SIZE,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/floorplan"
import type { ExpandDir } from "@/components/floorplan/expand-buttons"

function defaultEdges() {
  return {
    top: { seatCount: 3 },
    right: { seatCount: 0 },
    bottom: { seatCount: 3 },
    left: { seatCount: 0 },
  }
}

function defaultShapeProps(): Pick<FloorPlanShape, "fill" | "stroke" | "strokeWidth" | "opacity" | "rotation"> {
  return {
    fill: "rgba(200, 169, 110, 0.15)",
    stroke: "rgba(200, 169, 110, 0.3)",
    strokeWidth: 1,
    opacity: 1,
    rotation: 0,
  }
}

export function useFloorplanState(
  layout: FloorPlanLayout,
  onLayoutChange: (layout: FloorPlanLayout) => void
) {
  const tables = layout.tables ?? []
  const shapes = layout.shapes ?? []

  const update = useCallback(
    (patch: Partial<FloorPlanLayout>) => {
      onLayoutChange({ ...layout, ...patch })
    },
    [layout, onLayoutChange]
  )

  // ── Table operations ──────────────────────────────────────

  const updateTables = useCallback(
    (newTables: FloorPlanTable[]) => update({ tables: newTables }),
    [update]
  )

  const addTable = useCallback(
    (centerX: number, centerY: number) => {
      const x = Math.round(centerX / GRID_SIZE) * GRID_SIZE
      const y = Math.round(centerY / GRID_SIZE) * GRID_SIZE
      const id = generateId()
      const label = generateTableLabel(tables)
      const newTable: FloorPlanTable = {
        id,
        label,
        x,
        y,
        width: DEFAULT_TABLE_WIDTH,
        height: DEFAULT_TABLE_HEIGHT,
        rotation: 0,
        edges: defaultEdges(),
      }
      updateTables([...tables, newTable])
      return newTable.id
    },
    [tables, updateTables]
  )

  const updateTable = useCallback(
    (id: string, updates: Partial<FloorPlanTable>) => {
      updateTables(tables.map((t) => (t.id === id ? { ...t, ...updates } : t)))
    },
    [tables, updateTables]
  )

  const removeTable = useCallback(
    (id: string) => updateTables(tables.filter((t) => t.id !== id)),
    [tables, updateTables]
  )

  const updateEdge = useCallback(
    (tableId: string, edge: EdgeId, seatCount: number) => {
      updateTables(
        tables.map((t) =>
          t.id === tableId
            ? { ...t, edges: { ...t.edges, [edge]: { seatCount: Math.max(0, Math.min(20, seatCount)) } } }
            : t
        )
      )
    },
    [tables, updateTables]
  )

  const rotateTable = useCallback(
    (id: string) => {
      const table = tables.find((t) => t.id === id)
      if (!table) return
      updateTable(id, { rotation: (table.rotation + 45) % 360 })
    },
    [tables, updateTable]
  )

  const renameTable = useCallback(
    (id: string, label: string) => updateTable(id, { label }),
    [updateTable]
  )

  const resizeTable = useCallback(
    (id: string, width: number, height: number) => {
      updateTable(id, {
        width: Math.max(60, Math.min(600, width)),
        height: Math.max(30, Math.min(400, height)),
      })
    },
    [updateTable]
  )

  const moveTable = useCallback(
    (id: string, x: number, y: number) => updateTable(id, { x, y }),
    [updateTable]
  )

  const expandTable = useCallback(
    (sourceId: string, dir: ExpandDir, newX: number, newY: number) => {
      const source = tables.find((t) => t.id === sourceId)
      if (!source) return null
      const id = generateId()
      const label = computeExpandLabel(source, dir, tables)
      const newTable: FloorPlanTable = { ...source, id, label, x: newX, y: newY }
      updateTables([...tables, newTable])
      return id
    },
    [tables, updateTables]
  )

  // ── Shape operations ──────────────────────────────────────

  const updateShapes = useCallback(
    (newShapes: FloorPlanShape[]) => update({ shapes: newShapes }),
    [update]
  )

  const addShape = useCallback(
    (type: FloorPlanShape["type"], x: number, y: number, extra?: Partial<FloorPlanShape>) => {
      const id = generateId()
      const base: FloorPlanShape = {
        id,
        type,
        x,
        y,
        ...defaultShapeProps(),
        ...extra,
      } as FloorPlanShape

      // Set type-specific defaults
      if (type === "rectangle") {
        base.width = extra?.width ?? 100
        base.height = extra?.height ?? 60
      } else if (type === "circle") {
        base.radius = extra?.radius ?? 40
      } else if (type === "line") {
        base.points = extra?.points ?? [0, 0, 100, 0]
      } else if (type === "polygon") {
        base.points = extra?.points ?? [0, -40, 40, 20, -40, 20]
      }

      updateShapes([...shapes, base])
      return id
    },
    [shapes, updateShapes]
  )

  const updateShape = useCallback(
    (id: string, updates: Partial<FloorPlanShape>) => {
      updateShapes(shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)))
    },
    [shapes, updateShapes]
  )

  const removeShape = useCallback(
    (id: string) => updateShapes(shapes.filter((s) => s.id !== id)),
    [shapes, updateShapes]
  )

  const moveShape = useCallback(
    (id: string, x: number, y: number) => updateShape(id, { x, y }),
    [updateShape]
  )

  return {
    tables,
    shapes,
    addTable,
    updateTable,
    removeTable,
    updateEdge,
    rotateTable,
    renameTable,
    resizeTable,
    moveTable,
    expandTable,
    addShape,
    updateShape,
    removeShape,
    moveShape,
  }
}
