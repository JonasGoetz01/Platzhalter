import type { FloorPlanTable, ComputedSeat, EdgeId, Person } from "@/lib/types"
import { computeSeatsForTable } from "./compute-seats"

export interface PlacementResult {
  success: boolean
  assignments: { personId: string; tableId: string; seatRef: string }[]
  overflow: string[] // person IDs that couldn't be placed
  message?: string
}

/**
 * Compute placement for a group of persons on a table.
 *
 * Strategy:
 * - If targetEdge is specified, place along that edge's free seats
 * - If "center" or no edge, distribute across opposite edges (longer edges preferred)
 * - Overflow: suggest alternative edges
 */
export function computeGroupPlacement(
  personIds: string[],
  table: FloorPlanTable,
  targetEdge: EdgeId | "center" | null,
  occupiedSeatRefs: Set<string>
): PlacementResult {
  const seats = computeSeatsForTable(table)
  const freeSeats = seats.filter(
    (s) => !occupiedSeatRefs.has(`${table.id}:${s.seatRef}`)
  )

  if (freeSeats.length === 0) {
    return {
      success: false,
      assignments: [],
      overflow: personIds,
      message: "Keine freien Plätze an diesem Tisch",
    }
  }

  if (personIds.length > freeSeats.length) {
    // Partial placement — fill what we can
    const assignments = freeSeats.slice(0, personIds.length).map((seat, i) => ({
      personId: personIds[i],
      tableId: table.id,
      seatRef: seat.seatRef,
    }))
    return {
      success: false,
      assignments,
      overflow: personIds.slice(freeSeats.length),
      message: `Nur ${freeSeats.length} von ${personIds.length} Plätzen verfügbar`,
    }
  }

  let selectedSeats: ComputedSeat[]

  if (targetEdge && targetEdge !== "center") {
    // Place along specific edge
    const edgeFree = freeSeats.filter((s) => s.edge === targetEdge)
    if (edgeFree.length >= personIds.length) {
      selectedSeats = edgeFree.slice(0, personIds.length)
    } else {
      // Not enough on target edge — spill to other edges
      selectedSeats = [...edgeFree]
      const remaining = freeSeats.filter((s) => s.edge !== targetEdge)
      selectedSeats.push(...remaining.slice(0, personIds.length - edgeFree.length))
    }
  } else {
    // Center: distribute across edges, preferring longer edges
    selectedSeats = distributeAcrossEdges(freeSeats, personIds.length, table)
  }

  const assignments = selectedSeats.map((seat, i) => ({
    personId: personIds[i],
    tableId: table.id,
    seatRef: seat.seatRef,
  }))

  return {
    success: true,
    assignments,
    overflow: [],
  }
}

function distributeAcrossEdges(
  freeSeats: ComputedSeat[],
  count: number,
  table: FloorPlanTable
): ComputedSeat[] {
  // Sort edges by length (longer first)
  const edgeLengths: { edge: EdgeId; length: number }[] = ([
    { edge: "top" as EdgeId, length: table.width },
    { edge: "bottom" as EdgeId, length: table.width },
    { edge: "left" as EdgeId, length: table.height },
    { edge: "right" as EdgeId, length: table.height },
  ] satisfies { edge: EdgeId; length: number }[]).sort((a, b) => b.length - a.length)

  const result: ComputedSeat[] = []
  let remaining = count

  for (const { edge } of edgeLengths) {
    if (remaining <= 0) break
    const edgeFree = freeSeats.filter(
      (s) => s.edge === edge && !result.includes(s)
    )
    const take = Math.min(edgeFree.length, remaining)
    result.push(...edgeFree.slice(0, take))
    remaining -= take
  }

  return result
}

/**
 * Returns "tableId:seatRef" keys for free seats that lie between members of a
 * group (in clockwise seat order). Placing a non-group person on these seats
 * would split the group, so they should be treated as blocked.
 *
 * Algorithm: For each group with 2+ members, walk every consecutive pair of
 * members in clockwise order. Any free seats between them are blocked.
 */
export function getGroupBlockedSeats(
  tableId: string,
  seats: ComputedSeat[],
  seatGroupMap: Map<string, string>,
  personGroupId: string | null
): Set<string> {
  const blocked = new Set<string>()
  const n = seats.length
  if (n < 3) return blocked

  // Build index → groupId for occupied seats on this table
  const indexGroup = new Map<number, string>()
  for (let i = 0; i < n; i++) {
    const key = `${tableId}:${seats[i].seatRef}`
    const g = seatGroupMap.get(key)
    if (g) indexGroup.set(i, g)
  }

  // Collect positions per group
  const groupPositions = new Map<string, number[]>()
  for (const [idx, gid] of indexGroup) {
    if (gid === personGroupId) continue
    let arr = groupPositions.get(gid)
    if (!arr) {
      arr = []
      groupPositions.set(gid, arr)
    }
    arr.push(idx)
  }

  for (const [, positions] of groupPositions) {
    if (positions.length < 2) continue
    positions.sort((a, b) => a - b)

    // Find the largest gap between consecutive members (circular).
    // The arc OUTSIDE the largest gap is the minimal arc containing all members.
    let maxGap = -1
    let maxGapEnd = 0 // index in positions[] of the member AFTER the largest gap
    for (let i = 0; i < positions.length; i++) {
      const cur = positions[i]
      const nxt = positions[(i + 1) % positions.length]
      const gap = nxt > cur ? nxt - cur : n - cur + nxt
      if (gap > maxGap) {
        maxGap = gap
        maxGapEnd = (i + 1) % positions.length
      }
    }

    // Walk the minimal arc: from the member after the largest gap,
    // through all members and the gaps between them, to the member
    // before the largest gap. Block every FREE seat in between.
    const first = positions[maxGapEnd]
    const last = positions[(maxGapEnd + positions.length - 1) % positions.length]

    // Walk from first to last (inclusive endpoints are group members, skip them)
    let idx = (first + 1) % n
    while (idx !== last) {
      const key = `${tableId}:${seats[idx].seatRef}`
      // Only block if the seat is free (not occupied by anyone)
      if (!seatGroupMap.has(key)) {
        blocked.add(key)
      }
      idx = (idx + 1) % n
    }
  }

  return blocked
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
