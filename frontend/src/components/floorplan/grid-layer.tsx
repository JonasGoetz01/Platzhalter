import { Line } from "react-konva"
import { GRID_SIZE } from "@/lib/floorplan"

export function GridLines({ width, height }: { width: number; height: number }) {
  const lines: React.ReactElement[] = []
  for (let x = 0; x <= width; x += GRID_SIZE) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}
        stroke="rgba(232, 228, 220, 0.03)"
        strokeWidth={1}
      />
    )
  }
  for (let y = 0; y <= height; y += GRID_SIZE) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke="rgba(232, 228, 220, 0.03)"
        strokeWidth={1}
      />
    )
  }
  return <>{lines}</>
}
