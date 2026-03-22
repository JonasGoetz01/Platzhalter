import { Layer, Circle, Text } from "react-konva"
import type { ComputedSeat } from "@/lib/types"
import { SEAT_RADIUS } from "@/lib/floorplan"

interface DragGhostLayerProps {
  /** Seats where the ghost preview should appear */
  ghostSeats: ComputedSeat[]
  /** Whether placement is valid (green) or invalid (red) */
  valid: boolean
  /** Person names to show in ghost seats */
  names: string[]
}

export function DragGhostLayer({ ghostSeats, valid, names }: DragGhostLayerProps) {
  if (ghostSeats.length === 0) return null

  const fill = valid
    ? "rgba(100, 200, 100, 0.3)"
    : "rgba(200, 100, 100, 0.3)"
  const stroke = valid
    ? "rgba(100, 200, 100, 0.7)"
    : "rgba(200, 100, 100, 0.7)"

  return (
    <Layer listening={false}>
      {ghostSeats.map((seat, i) => (
        <GhostSeat
          key={seat.id}
          seat={seat}
          fill={fill}
          stroke={stroke}
          label={names[i] ? names[i].slice(0, 2).toUpperCase() : ""}
        />
      ))}
    </Layer>
  )
}

function GhostSeat({
  seat,
  fill,
  stroke,
  label,
}: {
  seat: ComputedSeat
  fill: string
  stroke: string
  label: string
}) {
  return (
    <>
      <Circle
        x={seat.x}
        y={seat.y}
        radius={SEAT_RADIUS}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        dash={[4, 3]}
        opacity={0.8}
      />
      {label && (
        <Text
          x={seat.x - SEAT_RADIUS}
          y={seat.y - SEAT_RADIUS}
          width={SEAT_RADIUS * 2}
          height={SEAT_RADIUS * 2}
          text={label}
          fontSize={10}
          fill="rgba(232, 228, 220, 0.7)"
          align="center"
          verticalAlign="middle"
          fontFamily="IBM Plex Mono"
        />
      )}
    </>
  )
}
