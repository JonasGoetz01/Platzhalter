import { useRef, useCallback } from "react"
import { Group, Rect, Text, Line } from "react-konva"
import type { FloorPlanTable, EdgeId } from "@/lib/types"
import { TABLE_COLORS } from "@/lib/floorplan"

interface TableRendererProps {
  table: FloorPlanTable
  selected: boolean
  draggable: boolean
  onSelect: () => void
  onDragMove: (id: string, x: number, y: number) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onLongPress?: () => void
}

/** Edge highlight lines showing which edges have seats. */
function EdgeHighlights({ table }: { table: FloorPlanTable }) {
  const { width: w, height: h } = table
  const edges: { edge: EdgeId; points: number[] }[] = [
    { edge: "top", points: [-w / 2, -h / 2, w / 2, -h / 2] },
    { edge: "right", points: [w / 2, -h / 2, w / 2, h / 2] },
    { edge: "bottom", points: [w / 2, h / 2, -w / 2, h / 2] },
    { edge: "left", points: [-w / 2, h / 2, -w / 2, -h / 2] },
  ]

  return (
    <>
      {edges
        .filter(({ edge }) => table.edges[edge].seatCount > 0)
        .map(({ edge, points }) => (
          <Line
            key={edge}
            points={points}
            stroke={TABLE_COLORS.edgeActive}
            strokeWidth={3}
            lineCap="round"
          />
        ))}
    </>
  )
}

export function TableRenderer({
  table,
  selected,
  draggable,
  onSelect,
  onDragMove,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
  onLongPress,
}: TableRendererProps) {
  const { width: w, height: h } = table
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    touchStartPos.current = null
  }, [])

  return (
    <Group
      id={`table-${table.id}`}
      x={table.x}
      y={table.y}
      rotation={table.rotation}
      draggable={draggable}
      onClick={onSelect}
      onTap={(e) => {
        // Don't fire tap if long-press was triggered
        if (!longPressTimer.current) return
        clearLongPress()
        onSelect()
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={(e) => {
        if (!onLongPress) return
        const touch = e.evt.touches[0]
        if (!touch) return
        touchStartPos.current = { x: touch.clientX, y: touch.clientY }
        longPressTimer.current = setTimeout(() => {
          longPressTimer.current = null
          onLongPress()
        }, 500)
      }}
      onTouchMove={(e) => {
        if (!touchStartPos.current || !longPressTimer.current) return
        const touch = e.evt.touches[0]
        if (!touch) return
        const dx = touch.clientX - touchStartPos.current.x
        const dy = touch.clientY - touchStartPos.current.y
        if (Math.hypot(dx, dy) > 10) {
          clearLongPress()
        }
      }}
      onTouchEnd={clearLongPress}
      onDragMove={(e) => {
        clearLongPress()
        onDragMove(table.id, e.target.position().x, e.target.position().y)
      }}
      onDragEnd={(e) => {
        onDragEnd(table.id, e.target.position().x, e.target.position().y)
      }}
    >
      <Rect
        width={w}
        height={h}
        offsetX={w / 2}
        offsetY={h / 2}
        cornerRadius={6}
        fill={TABLE_COLORS.fill}
        stroke={selected ? TABLE_COLORS.selectedStroke : TABLE_COLORS.stroke}
        strokeWidth={selected ? 2 : 1}
      />
      <EdgeHighlights table={table} />
      <Text
        text={table.label}
        fontSize={11}
        fill={TABLE_COLORS.text}
        align="center"
        verticalAlign="middle"
        width={w}
        height={20}
        offsetX={w / 2}
        offsetY={10}
        fontFamily="IBM Plex Mono"
      />
    </Group>
  )
}
