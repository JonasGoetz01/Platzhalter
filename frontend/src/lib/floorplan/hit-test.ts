import type { FloorPlanTable, ComputedSeat } from "@/lib/types"
import { SEAT_RADIUS } from "./constants"
import { getTableBounds } from "./geometry"

export interface HitTestResult {
  type: "seat" | "table" | "edge" | "none"
  tableId?: string
  seat?: ComputedSeat
  edge?: "top" | "right" | "bottom" | "left"
}

/**
 * Find what element is at the given canvas coordinates.
 * Priority: seat > table body > nothing
 */
export function hitTest(
  x: number,
  y: number,
  tables: FloorPlanTable[],
  allSeats: Map<string, ComputedSeat[]>
): HitTestResult {
  // Check seats first (smallest targets, highest priority)
  for (const [tableId, seats] of allSeats) {
    for (const seat of seats) {
      const dx = x - seat.x
      const dy = y - seat.y
      if (dx * dx + dy * dy <= SEAT_RADIUS * SEAT_RADIUS) {
        return { type: "seat", tableId, seat }
      }
    }
  }

  // Check table bodies
  for (const table of tables) {
    const bounds = getTableBounds(table)
    if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) {
      // Determine which edge is closest
      const dTop = Math.abs(y - bounds.top)
      const dBottom = Math.abs(y - bounds.bottom)
      const dLeft = Math.abs(x - bounds.left)
      const dRight = Math.abs(x - bounds.right)
      const minDist = Math.min(dTop, dBottom, dLeft, dRight)

      let edge: "top" | "right" | "bottom" | "left" = "top"
      if (minDist === dBottom) edge = "bottom"
      else if (minDist === dLeft) edge = "left"
      else if (minDist === dRight) edge = "right"

      return { type: "table", tableId: table.id, edge }
    }
  }

  return { type: "none" }
}

/**
 * Find the nearest free seat on a table to a given point.
 */
export function findNearestFreeSeat(
  x: number,
  y: number,
  tableId: string,
  seats: ComputedSeat[],
  occupiedSeatRefs: Set<string>
): ComputedSeat | null {
  let nearest: ComputedSeat | null = null
  let nearestDist = Infinity

  for (const seat of seats) {
    if (occupiedSeatRefs.has(`${tableId}:${seat.seatRef}`)) continue
    const dx = x - seat.x
    const dy = y - seat.y
    const dist = dx * dx + dy * dy
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = seat
    }
  }

  return nearest
}
