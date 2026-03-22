import { useState } from "react"
import { Group, Circle, Text } from "react-konva"
import type { FloorPlanTable } from "@/lib/types"
import { EXPAND_BTN_RADIUS, getTableOuterRadius } from "@/lib/floorplan"

export type ExpandDir = "left" | "right" | "top" | "bottom"

export interface ExpandButton {
  dir: ExpandDir
  x: number
  y: number
  newTableX: number
  newTableY: number
}

export function getExpandButtons(table: FloorPlanTable): ExpandButton[] {
  const { rx, ry } = getTableOuterRadius(table)
  const btnR = EXPAND_BTN_RADIUS

  return [
    {
      dir: "right",
      x: table.x + rx + btnR,
      y: table.y,
      newTableX: table.x + rx * 2,
      newTableY: table.y,
    },
    {
      dir: "left",
      x: table.x - rx - btnR,
      y: table.y,
      newTableX: table.x - rx * 2,
      newTableY: table.y,
    },
    {
      dir: "bottom",
      x: table.x,
      y: table.y + ry + btnR,
      newTableX: table.x,
      newTableY: table.y + ry * 2,
    },
    {
      dir: "top",
      x: table.x,
      y: table.y - ry - btnR,
      newTableX: table.x,
      newTableY: table.y - ry * 2,
    },
  ]
}

interface ExpandButtonComponentProps {
  btn: ExpandButton
  onClick: () => void
  onHoverEnter: () => void
  onHoverLeave: () => void
}

export function ExpandButtonComponent({
  btn,
  onClick,
  onHoverEnter,
  onHoverLeave,
}: ExpandButtonComponentProps) {
  const [active, setActive] = useState(false)
  const r = EXPAND_BTN_RADIUS

  return (
    <Group
      x={btn.x}
      y={btn.y}
      onClick={(e) => {
        e.cancelBubble = true
        onClick()
      }}
      onTap={(e) => {
        e.cancelBubble = true
        onClick()
      }}
      onMouseEnter={(e) => {
        setActive(true)
        onHoverEnter()
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = "pointer"
      }}
      onMouseLeave={(e) => {
        setActive(false)
        onHoverLeave()
        const stage = e.target.getStage()
        if (stage) stage.container().style.cursor = "default"
      }}
      onTouchStart={() => setActive(true)}
      onTouchEnd={() => setActive(false)}
    >
      <Circle
        radius={r}
        fill={
          active
            ? "rgba(200, 169, 110, 0.4)"
            : "rgba(200, 169, 110, 0.15)"
        }
        stroke={
          active
            ? "rgba(200, 169, 110, 0.9)"
            : "rgba(200, 169, 110, 0.4)"
        }
        strokeWidth={1.5}
      />
      <Text
        text="+"
        fontSize={16}
        fontStyle="bold"
        fill={
          active
            ? "rgba(200, 169, 110, 1)"
            : "rgba(200, 169, 110, 0.7)"
        }
        align="center"
        verticalAlign="middle"
        width={r * 2}
        height={r * 2}
        offsetX={r}
        offsetY={r}
      />
    </Group>
  )
}
