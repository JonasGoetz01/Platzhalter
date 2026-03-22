import { useRef } from "react"
import { Group, Circle, Text } from "react-konva"
import type Konva from "konva"
import type { ComputedSeat, Person } from "@/lib/types"
import { SEAT_RADIUS, TABLE_COLORS } from "@/lib/floorplan"

/** Zoom level above which full names are shown next to seats */
const NAME_LABEL_SCALE = 1.5

interface SeatRendererProps {
  seat: ComputedSeat
  person: Person | undefined
  /** Group color for the seated person (if in a group) */
  groupColor?: string | null
  /** Seat is blocked by a group — not assignable */
  blocked?: boolean
  /** Current canvas scale for zoom-dependent rendering */
  scale?: number
  /** Table center position (world coords) for computing outward direction */
  tableCenter?: { x: number; y: number }
  /** Table rotation in degrees */
  tableRotation?: number
  assignMode: boolean
  /** When set, only seats on this table are highlighted as assignable */
  assignTableId?: string | null
  /** Allow dragging occupied seats to move persons */
  seatDraggable?: boolean
  onSeatClick?: (tableId: string, seatRef: string) => void
  onOccupiedSeatClick?: (person: Person, seatX: number, seatY: number) => void
  onUnseat?: (personId: string) => void
  onSeatDragStart?: (person: Person, seat: ComputedSeat) => void
  onSeatDragMove?: (canvasX: number, canvasY: number) => void
  onSeatDragEnd?: (person: Person, canvasX: number, canvasY: number) => void
}

export function SeatRenderer({
  seat,
  person,
  groupColor,
  blocked = false,
  scale = 1,
  tableCenter,
  tableRotation = 0,
  assignMode,
  assignTableId,
  seatDraggable,
  onSeatClick,
  onOccupiedSeatClick,
  onUnseat,
  onSeatDragStart,
  onSeatDragMove,
  onSeatDragEnd,
}: SeatRendererProps) {
  const isFree = !person
  const onTargetTable = !assignTableId || seat.tableId === assignTableId
  const isAssignable = assignMode && isFree && onTargetTable && !blocked
  const canDrag = !!seatDraggable && !!person && !assignMode

  const groupRef = useRef<Konva.Group>(null)
  const personRef = useRef(person)
  personRef.current = person

  function handleClick(e: { cancelBubble: boolean }) {
    e.cancelBubble = true
    if (isAssignable && onSeatClick) {
      onSeatClick(seat.tableId, seat.seatRef)
    } else if (person && !assignMode && onOccupiedSeatClick) {
      onOccupiedSeatClick(person, seat.x, seat.y)
    } else if (person && assignMode && onUnseat) {
      onUnseat(person.id)
    }
  }

  /** Apply ghost styling imperatively (no React re-render) */
  function applyGhostStyle() {
    const g = groupRef.current
    if (!g) return
    const c = g.findOne("Circle") as Konva.Circle | undefined
    const t = g.findOne("Text") as Konva.Text | undefined
    if (c) {
      c.fill("rgba(200, 169, 110, 0.25)")
      c.stroke("rgba(200, 169, 110, 0.6)")
      c.strokeWidth(1.5)
      c.dash([4, 3])
    }
    if (t) {
      t.fill("rgba(232, 228, 220, 0.7)")
    }
  }

  /** Restore normal styling imperatively */
  function restoreStyle() {
    const g = groupRef.current
    if (!g) return
    const c = g.findOne("Circle") as Konva.Circle | undefined
    const t = g.findOne("Text") as Konva.Text | undefined
    if (c) {
      c.fill(fill)
      c.stroke(stroke)
      c.strokeWidth(strokeWidth)
      c.dash([])
    }
    if (t) {
      t.fill(textFill)
    }
  }

  const isBlockedVisible = assignMode && isFree && blocked

  const fill = isAssignable
    ? TABLE_COLORS.assignHighlight
    : isBlockedVisible
      ? "rgba(239, 68, 68, 0.15)" // red tint for blocked
      : person && groupColor
        ? `${groupColor}66` // 40% opacity
        : person
          ? TABLE_COLORS.seatOccupied
          : TABLE_COLORS.seatFill

  const stroke = isAssignable
    ? TABLE_COLORS.assignStroke
    : isBlockedVisible
      ? "rgba(239, 68, 68, 0.5)" // red border for blocked
      : person && groupColor
        ? `${groupColor}B3` // 70% opacity
        : person
          ? TABLE_COLORS.seatOccupiedStroke
          : TABLE_COLORS.seatStroke

  const strokeWidth = isAssignable ? 2 : isBlockedVisible ? 1.5 : 1

  const text = person
    ? person.name.slice(0, 2).toUpperCase()
    : seat.label

  const fontSize = person ? 10 : 9
  const textFill = person ? TABLE_COLORS.personText : TABLE_COLORS.text

  return (
    <Group
      ref={groupRef}
      x={seat.x}
      y={seat.y}
      draggable={canDrag}
      onClick={handleClick}
      onTap={handleClick}
      onDragStart={(e) => {
        e.cancelBubble = true
        applyGhostStyle()
        if (personRef.current) onSeatDragStart?.(personRef.current, seat)
      }}
      onDragMove={(e) => {
        e.cancelBubble = true
        const g = groupRef.current
        if (g) onSeatDragMove?.(g.x(), g.y())
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true
        const g = groupRef.current
        if (!g) return
        const cx = g.x()
        const cy = g.y()
        // Reset position — the actual move is handled via API
        g.position({ x: seat.x, y: seat.y })
        // Restore normal styling to clear the ghost dash
        restoreStyle()
        g.getLayer()?.batchDraw()
        if (personRef.current) onSeatDragEnd?.(personRef.current, cx, cy)
      }}
    >
      <Circle
        radius={SEAT_RADIUS}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <Text
        text={text}
        fontSize={fontSize}
        fill={textFill}
        align="center"
        verticalAlign="middle"
        width={SEAT_RADIUS * 2}
        height={SEAT_RADIUS * 2}
        offsetX={SEAT_RADIUS}
        offsetY={SEAT_RADIUS}
        fontFamily="IBM Plex Mono"
      />
      {person && scale >= NAME_LABEL_SCALE && tableCenter && (() => {
        // Pure edge-perpendicular offset (no diagonal drift for off-center seats)
        const rad = (tableRotation * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        // Base outward unit vector per edge (before table rotation)
        const [bx, by] =
          seat.edge === "top" ? [0, -1] :
          seat.edge === "bottom" ? [0, 1] :
          seat.edge === "left" ? [-1, 0] :
          [1, 0] // right
        // Rotate by table rotation
        const ux = bx * cos - by * sin
        const uy = bx * sin + by * cos
        const offset = SEAT_RADIUS + 4
        const lx = ux * offset
        const ly = uy * offset
        // Rotation perpendicular to the table edge, reading outward
        const edgeAngle =
          seat.edge === "top" ? tableRotation - 90 :
          seat.edge === "bottom" ? tableRotation + 90 :
          seat.edge === "left" ? tableRotation + 180 :
          tableRotation // right
        const displayName = person.name.length > 15 ? person.name.slice(0, 14) + "\u2026" : person.name
        return (
          <Text
            x={lx}
            y={ly}
            text={displayName}
            fontSize={9}
            fill={TABLE_COLORS.personText}
            align="left"
            fontFamily="IBM Plex Mono"
            rotation={edgeAngle}
            offsetY={4.5}
            listening={false}
          />
        )
      })()}
    </Group>
  )
}
