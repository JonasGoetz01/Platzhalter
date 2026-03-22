export const GRID_SIZE = 20
export const SNAP_THRESHOLD = 25
export const MIN_SCALE = 0.2
export const MAX_SCALE = 5
export const SEAT_RADIUS = 18
export const SEAT_OFFSET = 30
export const EXPAND_BTN_RADIUS = 14

export const GUIDE_COLOR = "rgba(200, 169, 110, 0.6)"

export const TABLE_COLORS = {
  fill: "rgba(200, 169, 110, 0.15)",
  stroke: "rgba(200, 169, 110, 0.5)",
  selectedStroke: "rgba(200, 169, 110, 0.9)",
  seatFill: "rgba(232, 228, 220, 0.08)",
  seatStroke: "rgba(232, 228, 220, 0.2)",
  seatOccupied: "rgba(200, 169, 110, 0.4)",
  seatOccupiedStroke: "rgba(200, 169, 110, 0.7)",
  text: "rgba(232, 228, 220, 0.7)",
  personText: "rgba(232, 228, 220, 0.9)",
  edgeActive: "rgba(200, 169, 110, 0.6)",
  assignHighlight: "rgba(200, 169, 110, 0.3)",
  assignStroke: "rgba(200, 169, 110, 0.8)",
} as const

export const DEFAULT_TABLE_WIDTH = 160
export const DEFAULT_TABLE_HEIGHT = 60

export function generateId(): string {
  return crypto.randomUUID().slice(0, 8)
}
