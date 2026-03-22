import type { FloorPlanTable } from "@/lib/types"

/** Extract trailing number from a label, e.g. "Tisch 5" -> { prefix: "Tisch ", num: 5 } */
export function parseLabel(label: string): { prefix: string; num: number } | null {
  const match = label.match(/^(.*?)(\d+)$/)
  if (!match) return null
  return { prefix: match[1], num: parseInt(match[2], 10) }
}

/** Auto-generate a label for a new table based on existing tables. */
export function generateTableLabel(existingTables: FloorPlanTable[]): string {
  const prefix = "Tisch "
  let maxNum = 0
  for (const t of existingTables) {
    const parsed = parseLabel(t.label)
    if (parsed && parsed.prefix === prefix) {
      maxNum = Math.max(maxNum, parsed.num)
    }
  }
  return `${prefix}${maxNum + 1}`
}

type ExpandDir = "left" | "right" | "top" | "bottom"

/** Find tables roughly aligned on the same axis as source in the given direction. */
function findRowNumbers(
  source: FloorPlanTable,
  dir: ExpandDir,
  tables: FloorPlanTable[]
): number[] {
  const tolerance = 40
  const nums: number[] = []
  for (const t of tables) {
    const parsed = parseLabel(t.label)
    if (!parsed) continue
    if (dir === "left" || dir === "right") {
      if (Math.abs(t.y - source.y) < tolerance) nums.push(parsed.num)
    } else {
      if (Math.abs(t.x - source.x) < tolerance) nums.push(parsed.num)
    }
  }
  return nums
}

/** Compute label for an expanded (cloned) table based on row context. */
export function computeExpandLabel(
  source: FloorPlanTable,
  dir: ExpandDir,
  allTables: FloorPlanTable[]
): string {
  const parsed = parseLabel(source.label)
  if (!parsed) return ""

  const rowNums = findRowNumbers(source, dir, allTables)
  const next =
    dir === "right" || dir === "bottom"
      ? rowNums.length > 0
        ? Math.max(...rowNums) + 1
        : parsed.num + 1
      : rowNums.length > 0
        ? Math.min(...rowNums) - 1
        : parsed.num - 1
  return `${parsed.prefix}${next}`
}
