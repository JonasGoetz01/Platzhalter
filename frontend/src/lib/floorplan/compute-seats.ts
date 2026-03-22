import type { FloorPlanTable, ComputedSeat, EdgeId } from "@/lib/types"
import { SEAT_OFFSET } from "./constants"
import { rotatePoint } from "./geometry"

const EDGE_ORDER: EdgeId[] = ["top", "right", "bottom", "left"]

/**
 * Compute seat positions for a single table.
 * Seats are distributed evenly along each edge, then rotated.
 * Numbering is clockwise starting from top-left.
 */
export function computeSeatsForTable(table: FloorPlanTable): ComputedSeat[] {
  const seats: ComputedSeat[] = []
  let labelCounter = 1

  for (const edge of EDGE_ORDER) {
    const count = table.edges[edge].seatCount
    if (count === 0) continue

    const edgeSeats = computeEdgeSeats(table, edge, count, labelCounter)
    seats.push(...edgeSeats)
    labelCounter += count
  }

  return seats
}

function computeEdgeSeats(
  table: FloorPlanTable,
  edge: EdgeId,
  count: number,
  startLabel: number
): ComputedSeat[] {
  const { id: tableId, x: cx, y: cy, width: w, height: h, rotation } = table
  const seats: ComputedSeat[] = []

  for (let i = 0; i < count; i++) {
    // Compute local position (before rotation) relative to table center
    const { lx, ly } = getLocalSeatPosition(edge, i, count, w, h)

    // Apply table rotation
    const rotated = rotatePoint(cx + lx, cy + ly, cx, cy, rotation)

    seats.push({
      id: `${tableId}-${edge}-${i}`,
      tableId,
      edge,
      index: i,
      seatRef: `${edge}-${i}`,
      x: rotated.x,
      y: rotated.y,
      label: String(startLabel + i),
    })
  }

  return seats
}

function getLocalSeatPosition(
  edge: EdgeId,
  index: number,
  count: number,
  width: number,
  height: number
): { lx: number; ly: number } {
  switch (edge) {
    case "top": {
      // Seats above the table, distributed left-to-right
      const spacing = width / (count + 1)
      return {
        lx: -width / 2 + spacing * (index + 1),
        ly: -height / 2 - SEAT_OFFSET,
      }
    }
    case "bottom": {
      // Seats below the table, distributed right-to-left (clockwise)
      const spacing = width / (count + 1)
      return {
        lx: width / 2 - spacing * (index + 1),
        ly: height / 2 + SEAT_OFFSET,
      }
    }
    case "right": {
      // Seats to the right, distributed top-to-bottom
      const spacing = height / (count + 1)
      return {
        lx: width / 2 + SEAT_OFFSET,
        ly: -height / 2 + spacing * (index + 1),
      }
    }
    case "left": {
      // Seats to the left, distributed bottom-to-top (clockwise)
      const spacing = height / (count + 1)
      return {
        lx: -width / 2 - SEAT_OFFSET,
        ly: height / 2 - spacing * (index + 1),
      }
    }
  }
}

/** Get the total seat count for a table across all edges. */
export function getTotalSeatCount(table: FloorPlanTable): number {
  return EDGE_ORDER.reduce((sum, edge) => sum + table.edges[edge].seatCount, 0)
}
