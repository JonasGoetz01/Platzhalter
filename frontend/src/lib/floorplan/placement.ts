import type { FloorPlanTable, ComputedSeat } from "@/lib/types"
import { computeSeatsForTable } from "./compute-seats"

export interface PlacementResult {
  success: boolean
  assignments: { personId: string; tableId: string; seatRef: string }[]
  overflow: string[] // person IDs that couldn't be placed
  message?: string
}

/**
 * Compute placement for a single person on the nearest free seat.
 */
export function computeSinglePlacement(
  personId: string,
  tableId: string,
  seats: ComputedSeat[],
  occupiedSeatRefs: Set<string>,
  targetX?: number,
  targetY?: number
): PlacementResult {
  const freeSeats = seats.filter(
    (s) => !occupiedSeatRefs.has(`${tableId}:${s.seatRef}`)
  )

  if (freeSeats.length === 0) {
    return {
      success: false,
      assignments: [],
      overflow: [personId],
      message: "Keine freien Plätze",
    }
  }

  // If target position given, find nearest free seat
  let seat = freeSeats[0]
  if (targetX !== undefined && targetY !== undefined) {
    let minDist = Infinity
    for (const s of freeSeats) {
      const dx = targetX - s.x
      const dy = targetY - s.y
      const dist = dx * dx + dy * dy
      if (dist < minDist) {
        minDist = dist
        seat = s
      }
    }
  }

  return {
    success: true,
    assignments: [{ personId, tableId, seatRef: seat.seatRef }],
    overflow: [],
  }
}
