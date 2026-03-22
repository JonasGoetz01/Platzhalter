import type { FloorPlanTable } from "@/lib/types"
import { SNAP_THRESHOLD } from "./constants"
import { getTableBounds } from "./geometry"

export interface SnapGuide {
  orientation: "H" | "V"
  pos: number
  start: number
  end: number
}

export interface SnapResult {
  x: number
  y: number
  guides: SnapGuide[]
}

/**
 * Compute snap alignment for a dragged table.
 * Supports:
 * - Center-to-center alignment
 * - Edge-to-edge alignment (left/right/top/bottom edges)
 * - Corner-to-corner for L/U formations (edge-of-A to opposite-edge-of-B)
 */
export function computeSnap(
  draggedId: string,
  rawX: number,
  rawY: number,
  tables: FloorPlanTable[]
): SnapResult {
  const dragged = tables.find((t) => t.id === draggedId)
  if (!dragged) return { x: rawX, y: rawY, guides: [] }

  const dBounds = getTableBounds(dragged, rawX, rawY)
  // X edges: left, center, right
  const dEdgesX = [dBounds.left, dBounds.cx, dBounds.right]
  // Y edges: top, center, bottom
  const dEdgesY = [dBounds.top, dBounds.cy, dBounds.bottom]

  let bestDx: number | null = null
  let bestAbsDx = SNAP_THRESHOLD + 1
  let bestDy: number | null = null
  let bestAbsDy = SNAP_THRESHOLD + 1
  const guidesX: SnapGuide[] = []
  const guidesY: SnapGuide[] = []

  for (const other of tables) {
    if (other.id === draggedId) continue
    const oBounds = getTableBounds(other)
    const oEdgesX = [oBounds.left, oBounds.cx, oBounds.right]
    const oEdgesY = [oBounds.top, oBounds.cy, oBounds.bottom]

    // Standard alignment: match any edge to any edge (center, left, right)
    for (const de of dEdgesX) {
      for (const oe of oEdgesX) {
        const dx = de - oe
        if (Math.abs(dx) < SNAP_THRESHOLD) {
          if (Math.abs(dx) < bestAbsDx) {
            bestDx = dx
            bestAbsDx = Math.abs(dx)
          }
          guidesX.push({
            orientation: "V",
            pos: oe,
            start: Math.min(dBounds.top, oBounds.top) - 20,
            end: Math.max(dBounds.bottom, oBounds.bottom) + 20,
          })
        }
      }
    }

    for (const de of dEdgesY) {
      for (const oe of oEdgesY) {
        const dy = de - oe
        if (Math.abs(dy) < SNAP_THRESHOLD) {
          if (Math.abs(dy) < bestAbsDy) {
            bestDy = dy
            bestAbsDy = Math.abs(dy)
          }
          guidesY.push({
            orientation: "H",
            pos: oe,
            start: Math.min(dBounds.left, oBounds.left) - 20,
            end: Math.max(dBounds.right, oBounds.right) + 20,
          })
        }
      }
    }

    // Edge-to-edge abutting: right-of-dragged → left-of-other (and vice versa)
    checkEdgeAbut(dBounds.right, oBounds.left, "V", dBounds, oBounds, guidesX, (dx) => {
      if (Math.abs(dx) < bestAbsDx) { bestDx = dx; bestAbsDx = Math.abs(dx) }
    })
    checkEdgeAbut(dBounds.left, oBounds.right, "V", dBounds, oBounds, guidesX, (dx) => {
      if (Math.abs(dx) < bestAbsDx) { bestDx = dx; bestAbsDx = Math.abs(dx) }
    })
    checkEdgeAbut(dBounds.bottom, oBounds.top, "H", dBounds, oBounds, guidesY, (dy) => {
      if (Math.abs(dy) < bestAbsDy) { bestDy = dy; bestAbsDy = Math.abs(dy) }
    })
    checkEdgeAbut(dBounds.top, oBounds.bottom, "H", dBounds, oBounds, guidesY, (dy) => {
      if (Math.abs(dy) < bestAbsDy) { bestDy = dy; bestAbsDy = Math.abs(dy) }
    })
  }

  const snappedX = bestDx !== null ? rawX - bestDx : rawX
  const snappedY = bestDy !== null ? rawY - bestDy : rawY

  // Filter to only guides that match the snapped position
  const activeGuides: SnapGuide[] = []
  if (bestDx !== null) {
    const sb = getTableBounds(dragged, snappedX, snappedY)
    const edges = [sb.left, sb.cx, sb.right]
    for (const g of guidesX) {
      if (edges.some((e) => Math.abs(e - g.pos) < 1)) activeGuides.push(g)
    }
  }
  if (bestDy !== null) {
    const sb = getTableBounds(dragged, snappedX, snappedY)
    const edges = [sb.top, sb.cy, sb.bottom]
    for (const g of guidesY) {
      if (edges.some((e) => Math.abs(e - g.pos) < 1)) activeGuides.push(g)
    }
  }

  return { x: snappedX, y: snappedY, guides: activeGuides }
}

interface BoundsLike {
  left: number
  right: number
  top: number
  bottom: number
}

function checkEdgeAbut(
  draggedEdge: number,
  otherEdge: number,
  orientation: "H" | "V",
  dBounds: BoundsLike,
  oBounds: BoundsLike,
  guides: SnapGuide[],
  onSnap: (delta: number) => void
) {
  const delta = draggedEdge - otherEdge
  if (Math.abs(delta) < SNAP_THRESHOLD) {
    onSnap(delta)
    if (orientation === "V") {
      guides.push({
        orientation: "V",
        pos: otherEdge,
        start: Math.min(dBounds.top, oBounds.top) - 10,
        end: Math.max(dBounds.bottom, oBounds.bottom) + 10,
      })
    } else {
      guides.push({
        orientation: "H",
        pos: otherEdge,
        start: Math.min(dBounds.left, oBounds.left) - 10,
        end: Math.max(dBounds.right, oBounds.right) + 10,
      })
    }
  }
}
