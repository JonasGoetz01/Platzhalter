export { computeSeatsForTable, getTotalSeatCount } from "./compute-seats"
export {
  GRID_SIZE,
  SNAP_THRESHOLD,
  MIN_SCALE,
  MAX_SCALE,
  SEAT_RADIUS,
  SEAT_OFFSET,
  EXPAND_BTN_RADIUS,
  GUIDE_COLOR,
  TABLE_COLORS,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  generateId,
} from "./constants"
export { getTableBounds, getTableOuterRadius, rotatePoint } from "./geometry"
export type { Bounds } from "./geometry"
export { parseLabel, generateTableLabel, computeExpandLabel } from "./numbering"
export { computeSnap } from "./snap"
export type { SnapGuide, SnapResult } from "./snap"
export { migrateLayout } from "./migrate"
export { hitTest, findNearestFreeSeat } from "./hit-test"
export type { HitTestResult } from "./hit-test"
export { computeGroupPlacement, computeSinglePlacement, getGroupBlockedSeats } from "./placement"
export type { PlacementResult } from "./placement"
