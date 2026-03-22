export interface Event {
  id: string
  name: string
  event_date: string | null
  description: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface FloorPlan {
  id: string
  event_id: string
  layout: FloorPlanLayout
  version: number
  updated_at: string
}

export interface FloorPlanLayout {
  tables: FloorPlanTable[]
  shapes?: FloorPlanShape[]
  width: number
  height: number
}

// ── Edge-based table model ──────────────────────────────────

export type EdgeId = "top" | "right" | "bottom" | "left"

export interface EdgeConfig {
  seatCount: number
}

export interface FloorPlanTable {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  edges: Record<EdgeId, EdgeConfig>
}

/** Computed at runtime from table geometry + edge config. Never persisted. */
export interface ComputedSeat {
  id: string        // globally unique: "tableId-edge-index"
  tableId: string
  edge: EdgeId
  index: number
  seatRef: string   // "edge-index" — stored in persons.seat_ref
  x: number         // world position (after rotation)
  y: number
  label: string     // display label (clockwise numbering)
}

// ── Decorative shapes (Phase 2 stub) ────────────────────────

export interface FloorPlanShape {
  id: string
  type: "rectangle" | "circle" | "line" | "polygon"
  x: number
  y: number
  rotation: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  width?: number
  height?: number
  radius?: number
  points?: number[]
}

// ── Legacy types (for migration) ────────────────────────────

export interface LegacyFloorPlanTable {
  id: string
  label: string
  x: number
  y: number
  shape: "round" | "rectangle"
  seats: LegacyFloorPlanSeat[]
  rotation?: number
  width?: number
  height?: number
  radius?: number
}

export interface LegacyFloorPlanSeat {
  id: string
  label: string
  angle?: number
  offsetX?: number
  offsetY?: number
}

// ── Person ──────────────────────────────────────────────────

export interface Person {
  id: string
  event_id: string
  name: string
  table_ref: string | null
  seat_ref: string | null
  booked_table: string | null
  parked: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  name: string
  email: string
  role: string
  email_verified: boolean
  created_at: string
  updated_at: string
}
