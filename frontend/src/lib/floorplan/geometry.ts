import type { FloorPlanTable } from "@/lib/types"
import { SEAT_OFFSET, SEAT_RADIUS } from "./constants"

export interface Bounds {
  left: number
  right: number
  top: number
  bottom: number
  cx: number
  cy: number
}

/** Get table bounds including seats, without rotation. */
export function getTableBounds(
  table: FloorPlanTable,
  overrideX?: number,
  overrideY?: number
): Bounds {
  const x = overrideX ?? table.x
  const y = overrideY ?? table.y
  const w = table.width
  const h = table.height
  const seatSpace = SEAT_OFFSET + SEAT_RADIUS

  // Check which edges have seats to determine bounds
  const hasTop = table.edges.top.seatCount > 0
  const hasBottom = table.edges.bottom.seatCount > 0
  const hasLeft = table.edges.left.seatCount > 0
  const hasRight = table.edges.right.seatCount > 0

  return {
    left: x - w / 2 - (hasLeft ? seatSpace : 0),
    right: x + w / 2 + (hasRight ? seatSpace : 0),
    top: y - h / 2 - (hasTop ? seatSpace : 0),
    bottom: y + h / 2 + (hasBottom ? seatSpace : 0),
    cx: x,
    cy: y,
  }
}

/** Distance from table center to outer edge (including seats) */
export function getTableOuterRadius(table: FloorPlanTable): {
  rx: number
  ry: number
} {
  const bounds = getTableBounds(table)
  return {
    rx: bounds.right - bounds.cx,
    ry: bounds.bottom - bounds.cy,
  }
}

/** Rotate a point (px, py) around (cx, cy) by angle in degrees. */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}
