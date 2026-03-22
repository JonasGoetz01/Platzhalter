import type {
  FloorPlanTable,
  FloorPlanLayout,
  EdgeId,
  LegacyFloorPlanTable,
  LegacyFloorPlanSeat,
} from "@/lib/types"
import { generateId, DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT } from "./constants"

interface MaybeLayout {
  tables: (FloorPlanTable | LegacyFloorPlanTable)[]
  shapes?: unknown[]
  width: number
  height: number
}

function isLegacyTable(
  t: FloorPlanTable | LegacyFloorPlanTable
): t is LegacyFloorPlanTable {
  return "shape" in t || "seats" in t
}

/** Migrate a legacy layout to the new edge-based format. */
export function migrateLayout(raw: MaybeLayout): FloorPlanLayout {
  const tables: FloorPlanTable[] = raw.tables.map((t) => {
    if (!isLegacyTable(t)) return t as FloorPlanTable
    return migrateLegacyTable(t)
  })

  return {
    tables,
    shapes: (raw.shapes as FloorPlanLayout["shapes"]) ?? [],
    width: raw.width,
    height: raw.height,
  }
}

function migrateLegacyTable(legacy: LegacyFloorPlanTable): FloorPlanTable {
  if (legacy.shape === "round") {
    return migrateRoundTable(legacy)
  }
  return migrateRectTable(legacy)
}

function migrateRoundTable(legacy: LegacyFloorPlanTable): FloorPlanTable {
  const seatCount = legacy.seats.length
  const diameter = (legacy.radius ?? 60) * 2
  const w = Math.max(diameter, DEFAULT_TABLE_WIDTH)
  const h = Math.max(DEFAULT_TABLE_HEIGHT, 60)

  // Distribute seats evenly between top and bottom edges
  const topCount = Math.ceil(seatCount / 2)
  const bottomCount = seatCount - topCount

  return {
    id: legacy.id,
    label: legacy.label,
    x: legacy.x,
    y: legacy.y,
    width: w,
    height: h,
    rotation: legacy.rotation ?? 0,
    edges: {
      top: { seatCount: topCount },
      right: { seatCount: 0 },
      bottom: { seatCount: bottomCount },
      left: { seatCount: 0 },
    },
  }
}

function migrateRectTable(legacy: LegacyFloorPlanTable): FloorPlanTable {
  const w = legacy.width ?? DEFAULT_TABLE_WIDTH
  const h = legacy.height ?? DEFAULT_TABLE_HEIGHT

  // Count seats by position (offsetY < 0 = top, offsetY > 0 = bottom)
  let topCount = 0
  let bottomCount = 0
  for (const seat of legacy.seats) {
    if ((seat.offsetY ?? 0) < 0) topCount++
    else bottomCount++
  }

  return {
    id: legacy.id,
    label: legacy.label,
    x: legacy.x,
    y: legacy.y,
    width: w,
    height: h,
    rotation: legacy.rotation ?? 0,
    edges: {
      top: { seatCount: topCount },
      right: { seatCount: 0 },
      bottom: { seatCount: bottomCount },
      left: { seatCount: 0 },
    },
  }
}
