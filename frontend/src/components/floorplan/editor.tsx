"use client"

import { useRef, useState, useCallback, useEffect, useMemo } from "react"
import { Stage, Layer, Line, Rect, Group, Circle, Text } from "react-konva"
import type Konva from "konva"
import type {
  FloorPlanLayout,
  FloorPlanTable,
  FloorPlanShape,
  Person,
  Group as GroupType,
  ComputedSeat,
  EdgeId,
} from "@/lib/types"
import {
  MIN_SCALE,
  MAX_SCALE,
  GUIDE_COLOR,
  SEAT_RADIUS,
  TABLE_COLORS,
  computeSnap,
  computeSeatsForTable,
  hitTest,
  findNearestFreeSeat,
  getGroupBlockedSeats,
} from "@/lib/floorplan"
import type { SnapGuide } from "@/lib/floorplan"
import { useFloorplanState } from "@/hooks/use-floorplan-state"
import { useUndoRedo } from "@/hooks/use-undo-redo"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useTranslations } from "next-intl"
import { UserXIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { GridLines } from "./grid-layer"
import { Toolbar } from "./toolbar"
import { TableRenderer } from "./table-renderer"
import { SeatRenderer } from "./seat-renderer"
import { EdgeSelector } from "./edge-selector"
import { ExpandButtonComponent, getExpandButtons } from "./expand-buttons"
import { ShapesLayer } from "./shapes-layer"
import { DrawingToolbar, type ToolMode } from "./drawing-toolbar"
import { ShapeProperties } from "./shape-properties"
import { MobileToolbar } from "./mobile-toolbar"
import { TableContextMenu } from "./table-context-menu"

export interface FloorPlanViewState {
  scale: number
  x: number
  y: number
}

interface EditorProps {
  mode?: "edit" | "seating"
  layout: FloorPlanLayout
  persons: Person[]
  groups?: GroupType[]
  onLayoutChange: (layout: FloorPlanLayout) => void
  onPersonUpdate: (person: Person) => void
  selectedPersonId?: string | null
  onSeatClick?: (tableId: string, seatRef: string) => void
  onUnseat?: (personId: string) => void
  onTableSelect?: (tableLabel: string | null) => void
  /** Mutable ref updated with current scale/position for external coordinate conversion */
  viewStateRef?: React.MutableRefObject<FloorPlanViewState>
  /** Table ID to highlight during drag-over */
  highlightTableId?: string | null
  /** When set, only highlight seats on this table in assign mode */
  assignTableId?: string | null
  /** When set, pan & zoom to center this table in view */
  focusTableId?: string | null
  /** Ghost seats to preview during group drag-over */
  previewSeats?: { x: number; y: number; initials: string; color?: string }[]
  /** Called when an occupied seat is dragged to a new canvas position */
  onSeatDragEnd?: (personId: string, canvasX: number, canvasY: number) => void
}

export function FloorPlanEditor({
  mode = "edit",
  layout,
  persons,
  groups: groupsProp,
  onLayoutChange,
  onPersonUpdate,
  selectedPersonId,
  onSeatClick,
  onUnseat,
  onTableSelect,
  viewStateRef,
  highlightTableId,
  assignTableId,
  focusTableId,
  previewSeats,
  onSeatDragEnd,
}: EditorProps) {
  const isEditMode = mode === "edit"
  const isMobile = useIsMobile()
  const t = useTranslations("common")
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [toolMode, setToolMode] = useState<ToolMode>("pointer")
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [polygonPoints, setPolygonPoints] = useState<number[]>([])
  const [contextMenuTableId, setContextMenuTableId] = useState<string | null>(null)
  const [seatTooltip, setSeatTooltip] = useState<{
    personId: string
    personName: string
    canvasX: number
    canvasY: number
  } | null>(null)

  // ── Seat drag (imperative — no React state to avoid re-render issues) ──
  const seatDragRef = useRef<{
    personId: string
    initials: string
    originX: number
    originY: number
    originLabel: string
  } | null>(null)
  const seatDragOriginRef = useRef<Konva.Group>(null)
  const seatDragPreviewRef = useRef<Konva.Group>(null)

  // Undo/redo wraps layout changes
  const undoRedo = useUndoRedo(layout, onLayoutChange)

  const {
    tables,
    shapes,
    addTable,
    removeTable,
    updateEdge,
    rotateTable,
    renameTable,
    resizeTable,
    moveTable,
    expandTable,
    addShape,
    updateShape,
    removeShape,
    moveShape,
  } = useFloorplanState(layout, undoRedo.set)

  const selectedTable = selectedTableId
    ? tables.find((t) => t.id === selectedTableId) ?? null
    : null
  const hoveredTable = hoveredTableId
    ? tables.find((t) => t.id === hoveredTableId) ?? null
    : null
  const selectedShape = selectedShapeId
    ? shapes.find((s) => s.id === selectedShapeId) ?? null
    : null
  const contextMenuTable = contextMenuTableId
    ? tables.find((t) => t.id === contextMenuTableId) ?? null
    : null

  // On mobile, show expand buttons on selected table instead of hovered
  const expandTargetTable = isMobile ? selectedTable : hoveredTable

  // Compute all seats
  const allSeats = useMemo(() => {
    const map = new Map<string, ComputedSeat[]>()
    for (const table of tables) {
      map.set(table.id, computeSeatsForTable(table))
    }
    return map
  }, [tables])

  // Person lookup
  const personMap = useMemo(() => {
    const map = new Map<string, Person>()
    for (const p of persons) {
      if (p.table_ref && p.seat_ref) {
        map.set(`${p.table_ref}:${p.seat_ref}`, p)
      }
    }
    return map
  }, [persons])

  // "tableId:seatRef" → groupId for group-reservation checks
  const seatGroupMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of persons) {
      if (p.group_id && p.table_ref && p.seat_ref) {
        map.set(`${p.table_ref}:${p.seat_ref}`, p.group_id)
      }
    }
    return map
  }, [persons])

  // groupId → color for fast lookup
  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>()
    if (groupsProp) {
      for (const g of groupsProp) map.set(g.id, g.color)
    }
    return map
  }, [groupsProp])

  // Group connection lines between seated members
  const groupConnections = useMemo(() => {
    if (!groupsProp || groupsProp.length === 0) return []

    // Build seat position lookup: personId → {x, y}
    const seatPositions = new Map<string, { x: number; y: number }>()
    for (const [tableId, seats] of allSeats) {
      for (const seat of seats) {
        const person = personMap.get(`${tableId}:${seat.seatRef}`)
        if (person) {
          seatPositions.set(person.id, { x: seat.x, y: seat.y })
        }
      }
    }

    const lines: { points: number[]; color: string }[] = []

    for (const group of groupsProp) {
      const seatedMembers = persons
        .filter((p) => p.group_id === group.id && p.table_ref && p.seat_ref)
        .map((p) => ({ person: p, pos: seatPositions.get(p.id)! }))
        .filter((m) => m.pos)

      if (seatedMembers.length < 2) continue

      // Connect members via minimum spanning tree (Prim's) so lines
      // always run between the closest pair — no long diagonals.
      const n = seatedMembers.length
      const inTree = new Uint8Array(n)
      const minDist = new Float64Array(n).fill(Infinity)
      const minEdge = new Int32Array(n).fill(-1)

      inTree[0] = 1
      for (let j = 1; j < n; j++) {
        const dx = seatedMembers[j].pos.x - seatedMembers[0].pos.x
        const dy = seatedMembers[j].pos.y - seatedMembers[0].pos.y
        minDist[j] = dx * dx + dy * dy
        minEdge[j] = 0
      }

      for (let added = 1; added < n; added++) {
        let u = -1
        for (let j = 0; j < n; j++) {
          if (!inTree[j] && (u === -1 || minDist[j] < minDist[u])) u = j
        }
        inTree[u] = 1
        lines.push({
          points: [
            seatedMembers[minEdge[u]].pos.x, seatedMembers[minEdge[u]].pos.y,
            seatedMembers[u].pos.x, seatedMembers[u].pos.y,
          ],
          color: group.color,
        })
        for (let j = 0; j < n; j++) {
          if (inTree[j]) continue
          const dx = seatedMembers[j].pos.x - seatedMembers[u].pos.x
          const dy = seatedMembers[j].pos.y - seatedMembers[u].pos.y
          const d = dx * dx + dy * dy
          if (d < minDist[j]) {
            minDist[j] = d
            minEdge[j] = u
          }
        }
      }
    }

    return lines
  }, [groupsProp, persons, allSeats, personMap])

  const expandButtons = useMemo(() => {
    if (!expandTargetTable || isDragging) return []
    return getExpandButtons(expandTargetTable)
  }, [expandTargetTable, isDragging])

  // ── Selection management ──────────────────────────────────

  function selectTable(id: string | null) {
    setSelectedTableId(id)
    if (id) setSelectedShapeId(null)
  }

  function selectShape(id: string | null) {
    setSelectedShapeId(id)
    if (id) setSelectedTableId(null)
  }

  // ── Keyboard shortcuts ────────────────────────────────────

  const handleDelete = useCallback(() => {
    if (selectedTableId) {
      removeTable(selectedTableId)
      setSelectedTableId(null)
    } else if (selectedShapeId) {
      removeShape(selectedShapeId)
      setSelectedShapeId(null)
    }
  }, [selectedTableId, selectedShapeId, removeTable, removeShape])

  useKeyboardShortcuts({
    onUndo: isEditMode ? undoRedo.undo : undefined,
    onRedo: isEditMode ? undoRedo.redo : undefined,
    onDelete: isEditMode ? handleDelete : undefined,
    onEscape: () => {
      setSelectedTableId(null)
      setSelectedShapeId(null)
      setToolMode("pointer")
      setDrawStart(null)
      setPolygonPoints([])
    },
  })

  // ── Hover management ──────────────────────────────────────

  const hoverEnter = useCallback((tableId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoveredTableId(tableId)
  }, [])

  const hoverLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => setHoveredTableId(null), 300)
  }, [])

  useEffect(
    () => () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    },
    []
  )

  // ── Sync view state ref for external coordinate conversion ──

  useEffect(() => {
    if (viewStateRef) {
      viewStateRef.current = { scale, x: position.x, y: position.y }
    }
  }, [scale, position, viewStateRef])

  // ── Focus on a specific table (pan + zoom) ────────────────

  useEffect(() => {
    if (!focusTableId) return
    const table = tables.find((t) => t.id === focusTableId)
    if (!table || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const targetScale = 1.3
    const cx = table.x
    const cy = table.y
    setScale(targetScale)
    setPosition({
      x: rect.width / 2 - cx * targetScale,
      y: rect.height / 2 - cy * targetScale,
    })
  }, [focusTableId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notify parent of selected table label ─────────────────

  useEffect(() => {
    onTableSelect?.(selectedTable?.label || null)
  }, [selectedTableId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Container resize ──────────────────────────────────────

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // ── Wheel zoom/pan ────────────────────────────────────────

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      if (e.evt.ctrlKey || e.evt.metaKey) {
        const oldScale = scale
        const pointer = stage.getPointerPosition()
        if (!pointer) return
        const scaleBy = 1.04
        const newScale =
          e.evt.deltaY < 0
            ? Math.min(oldScale * scaleBy, MAX_SCALE)
            : Math.max(oldScale / scaleBy, MIN_SCALE)
        const mousePointTo = {
          x: (pointer.x - position.x) / oldScale,
          y: (pointer.y - position.y) / oldScale,
        }
        setScale(newScale)
        setPosition({
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        })
      } else {
        setPosition((prev) => ({
          x: prev.x - e.evt.deltaX,
          y: prev.y - e.evt.deltaY,
        }))
      }
    },
    [scale, position]
  )

  // ── Touch gesture state ─────────────────────────────────
  const touchStateRef = useRef<{
    lastDist: number
    lastCenter: { x: number; y: number }
    isTwoFinger: boolean
    swipeStartX: number
    swipeStartY: number
  } | null>(null)
  const scaleRef = useRef(scale)
  useEffect(() => { scaleRef.current = scale }, [scale])
  const positionRef = useRef(position)
  useEffect(() => { positionRef.current = position }, [position])
  const touchRafRef = useRef<number | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const cx = (t1.clientX + t2.clientX) / 2
      const cy = (t1.clientY + t2.clientY) / 2
      touchStateRef.current = {
        lastDist: dist,
        lastCenter: { x: cx, y: cy },
        isTwoFinger: true,
        swipeStartX: cx,
        swipeStartY: cy,
      }
    }
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 2 || !touchStateRef.current) return

      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const cx = (t1.clientX + t2.clientX) / 2
      const cy = (t1.clientY + t2.clientY) / 2

      const state = touchStateRef.current
      const scaleFactor = dist / state.lastDist
      const dx = cx - state.lastCenter.x
      const dy = cy - state.lastCenter.y

      state.lastDist = dist
      state.lastCenter = { x: cx, y: cy }

      if (touchRafRef.current) cancelAnimationFrame(touchRafRef.current)
      touchRafRef.current = requestAnimationFrame(() => {
        touchRafRef.current = null
        const prevScale = scaleRef.current
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prevScale * scaleFactor))
        const prevPos = positionRef.current
        // Pan first, then zoom around pinch center
        const pannedX = prevPos.x + dx
        const pannedY = prevPos.y + dy
        setScale(newScale)
        setPosition({
          x: cx - (cx - pannedX) * (newScale / prevScale),
          y: cy - (cy - pannedY) * (newScale / prevScale),
        })
      })
    },
    []
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const state = touchStateRef.current
      if (!state) return

      if (touchRafRef.current) {
        cancelAnimationFrame(touchRafRef.current)
        touchRafRef.current = null
      }

      if (e.touches.length < 2 && state.isTwoFinger) {
        // Check for horizontal swipe (undo/redo)
        const dx = state.lastCenter.x - state.swipeStartX
        const dy = Math.abs(state.lastCenter.y - state.swipeStartY)

        if (Math.abs(dx) > 80 && dy < 40) {
          if (dx < 0 && isEditMode) {
            undoRedo.undo()
          } else if (dx > 0 && isEditMode) {
            undoRedo.redo()
          }
        }

        touchStateRef.current = null
      }
    },
    [isEditMode, undoRedo]
  )

  // ── Drag handlers ─────────────────────────────────────────

  function handleDragMove(tableId: string, rawX: number, rawY: number) {
    setIsDragging(true)
    const snap = computeSnap(tableId, rawX, rawY, tables)
    setSnapGuides(snap.guides)
    const stage = stageRef.current
    if (stage) {
      const layer = stage.findOne<Konva.Layer>("#tables-layer")
      const node = layer?.findOne<Konva.Group>(`#table-${tableId}`)
      if (node) node.position({ x: snap.x, y: snap.y })
    }
  }

  function handleDragEnd(tableId: string, rawX: number, rawY: number) {
    setIsDragging(false)
    const snap = computeSnap(tableId, rawX, rawY, tables)
    setSnapGuides([])
    moveTable(tableId, snap.x, snap.y)
  }

  // ── Drawing handlers ──────────────────────────────────────

  function getCanvasPoint(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = stageRef.current
    if (!stage) return null
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    return {
      x: (pointer.x - position.x) / scale,
      y: (pointer.y - position.y) / scale,
    }
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    // Suppress during two-finger gesture
    if (touchStateRef.current?.isTwoFinger) return

    const clickedOnEmpty = e.target === e.currentTarget

    if (toolMode === "pointer") {
      if (clickedOnEmpty) {
        setSelectedTableId(null)
        setSelectedShapeId(null)
        setSeatTooltip(null)
      }
      return
    }

    const pt = getCanvasPoint(e)
    if (!pt) return

    if (toolMode === "draw-polygon") {
      // Build polygon point-by-point
      setPolygonPoints((prev) => [...prev, pt.x, pt.y])
      return
    }

    if (toolMode === "draw-line") {
      if (!drawStart) {
        setDrawStart(pt)
      } else {
        const id = addShape("line", drawStart.x, drawStart.y, {
          points: [0, 0, pt.x - drawStart.x, pt.y - drawStart.y],
        })
        selectShape(id)
        setDrawStart(null)
        setToolMode("pointer")
      }
      return
    }

    // Rectangle/Circle: tap for default size
    if (toolMode === "draw-rectangle") {
      const id = addShape("rectangle", pt.x, pt.y)
      selectShape(id)
      setToolMode("pointer")
      return
    }

    if (toolMode === "draw-circle") {
      const id = addShape("circle", pt.x, pt.y)
      selectShape(id)
      setToolMode("pointer")
      return
    }
  }

  function handleStageDoubleClick() {
    if (toolMode === "draw-polygon" && polygonPoints.length >= 6) {
      // Close polygon — make points relative to first point
      const ox = polygonPoints[0]
      const oy = polygonPoints[1]
      const relPoints = polygonPoints.map((v, i) => (i % 2 === 0 ? v - ox : v - oy))
      const id = addShape("polygon", ox, oy, { points: relPoints })
      selectShape(id)
      setPolygonPoints([])
      setToolMode("pointer")
    }
  }

  // ── Toolbar actions ───────────────────────────────────────

  function handleAddTable() {
    const centerX = (dimensions.width / 2 - position.x) / scale
    const centerY = (dimensions.height / 2 - position.y) / scale
    const newId = addTable(centerX, centerY)
    selectTable(newId)
  }

  function handleDeleteSelected() {
    if (selectedTableId) {
      removeTable(selectedTableId)
      setSelectedTableId(null)
    } else if (selectedShapeId) {
      removeShape(selectedShapeId)
      setSelectedShapeId(null)
    }
  }

  function handleRotateSelected() {
    if (!selectedTableId) return
    rotateTable(selectedTableId)
  }

  function handleRenameTable(label: string) {
    if (!selectedTableId) return
    if (label.trim() === "") {
      toast.error("Table name required")
      return
    }
    renameTable(selectedTableId, label)
  }

  function handleResizeTable(width: number, height: number) {
    if (!selectedTableId) return
    resizeTable(selectedTableId, width, height)
  }

  function handleEdgeChange(tableId: string, edge: EdgeId, seatCount: number) {
    const table = tables.find((t) => t.id === tableId)
    if (table) {
      const currentCount = table.edges[edge].seatCount
      if (seatCount < currentCount) {
        // Check if any seats that would be removed are occupied
        for (let i = seatCount; i < currentCount; i++) {
          const seatRef = `${edge}-${i}`
          if (personMap.has(`${tableId}:${seatRef}`)) {
            toast.error("Occupied seats cannot be removed")
            return
          }
        }
      }
    }
    updateEdge(tableId, edge, seatCount)
  }

  function fitToView() {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  // ── Render ────────────────────────────────────────────────

  const toolbarHeight = isMobile ? 0 : 40
  const showDrawingTools = isEditMode
  const cursorStyle =
    toolMode !== "pointer" ? "crosshair" : undefined

  return (
    <div ref={containerRef} className="relative flex h-full w-full flex-col">
      {/* Desktop: toolbar at top */}
      <div className="hidden md:block">
        <Toolbar
          isEditMode={isEditMode}
          selectedTable={selectedTable}
          scale={scale}
          canUndo={undoRedo.canUndo}
          canRedo={undoRedo.canRedo}
          onAddTable={handleAddTable}
          onDeleteSelected={handleDeleteSelected}
          onRotateSelected={handleRotateSelected}
          onRenameTable={handleRenameTable}
          onResizeTable={handleResizeTable}
          onUndo={undoRedo.undo}
          onRedo={undoRedo.redo}
          onZoomIn={() => setScale((s) => Math.min(s * 1.2, MAX_SCALE))}
          onZoomOut={() => setScale((s) => Math.max(s / 1.2, MIN_SCALE))}
          onFitToView={fitToView}
        />
      </div>

      {/* Canvas + overlays */}
      <div
        className="relative flex-1 touch-none"
        style={{ cursor: cursorStyle }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-label="Floorplan editor canvas"
        role="application"
      >
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height - toolbarHeight}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          draggable={toolMode === "pointer"}
          onWheel={handleWheel}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onDblClick={handleStageDoubleClick}
          onDblTap={handleStageDoubleClick}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
              setPosition({ x: e.target.x(), y: e.target.y() })
              setSeatTooltip(null)
            }
          }}
        >
          {/* Grid */}
          <Layer>
            <GridLines
              width={layout.width || 2000}
              height={layout.height || 1500}
            />
          </Layer>

          {/* Decorative shapes (below tables) */}
          <ShapesLayer
            shapes={shapes}
            selectedShapeId={selectedShapeId}
            isEditMode={isEditMode}
            onSelectShape={selectShape}
            onShapeDragEnd={(id, x, y) => moveShape(id, x, y)}
            onShapeTransformEnd={(id, updates) => updateShape(id, updates)}
          />

          {/* Tables */}
          <Layer id="tables-layer">
            {tables.map((table) => {
              const handleTableSelect = () => {
                if (isEditMode) {
                  selectTable(table.id)
                } else {
                  onTableSelect?.(table.label || null)
                }
              }
              return (
                <TableRenderer
                  key={table.id}
                  table={table}
                  selected={table.id === selectedTableId}
                  draggable={isEditMode && toolMode === "pointer"}
                  onSelect={handleTableSelect}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onMouseEnter={() => hoverEnter(table.id)}
                  onMouseLeave={hoverLeave}
                  onLongPress={isEditMode && isMobile ? () => setContextMenuTableId(table.id) : undefined}
                />
              )
            })}
          </Layer>

          {/* Seats */}
          <Layer>
            {tables.map((table) => {
              const seats = allSeats.get(table.id) ?? []
              return seats.map((seat) => (
                <SeatRenderer
                  key={seat.id}
                  seat={seat}
                  person={personMap.get(`${seat.tableId}:${seat.seatRef}`)}
                  groupColor={groupColorMap.get(seatGroupMap.get(`${seat.tableId}:${seat.seatRef}`) ?? "")}
                  scale={scale}
                  tableCenter={{ x: table.x, y: table.y }}
                  tableRotation={table.rotation}
                  assignMode={!!selectedPersonId}
                  assignTableId={assignTableId}
                  seatDraggable={!isEditMode}
                  onSeatClick={(tableId, seatRef) => {
                    setSeatTooltip(null)
                    onSeatClick?.(tableId, seatRef)
                  }}
                  onOccupiedSeatClick={(person, seatX, seatY) => {
                    setSeatTooltip({
                      personId: person.id,
                      personName: person.name,
                      canvasX: seatX,
                      canvasY: seatY,
                    })
                  }}
                  onUnseat={onUnseat}
                  onSeatDragStart={(person, seatInfo) => {
                    setSeatTooltip(null)
                    seatDragRef.current = {
                      personId: person.id,
                      initials: person.name.slice(0, 2).toUpperCase(),
                      originX: seatInfo.x,
                      originY: seatInfo.y,
                      originLabel: seatInfo.label,
                    }
                    // Show static empty seat at origin
                    const origin = seatDragOriginRef.current
                    if (origin) {
                      origin.position({ x: seatInfo.x, y: seatInfo.y })
                      const t = origin.findOne("Text") as Konva.Text | undefined
                      if (t) t.text(seatInfo.label)
                      origin.visible(true)
                      origin.getLayer()?.batchDraw()
                    }
                  }}
                  onSeatDragMove={(canvasX, canvasY) => {
                    const drag = seatDragRef.current
                    if (!drag) return
                    const preview = seatDragPreviewRef.current
                    if (!preview) return

                    const hit = hitTest(canvasX, canvasY, tables, allSeats)
                    if (hit.tableId) {
                      const tSeats = allSeats.get(hit.tableId) ?? []
                      // Exclude dragged person's own seat
                      const adjusted = new Set<string>()
                      let dragGroupId: string | null = null
                      for (const key of personMap.keys()) {
                        const p = personMap.get(key)!
                        if (p.id === drag.personId) {
                          dragGroupId = p.group_id
                        } else {
                          adjusted.add(key)
                        }
                      }
                      // Block seats reserved by other groups
                      for (const key of getGroupBlockedSeats(hit.tableId, tSeats, seatGroupMap, dragGroupId)) {
                        adjusted.add(key)
                      }
                      const target = findNearestFreeSeat(
                        canvasX, canvasY, hit.tableId, tSeats, adjusted
                      )
                      if (target) {
                        preview.position({ x: target.x, y: target.y })
                        const t = preview.findOne("Text") as Konva.Text | undefined
                        if (t) t.text(drag.initials)
                        preview.visible(true)
                      } else {
                        preview.visible(false)
                      }
                    } else {
                      preview.visible(false)
                    }
                    preview.getLayer()?.batchDraw()
                  }}
                  onSeatDragEnd={(person, canvasX, canvasY) => {
                    seatDragRef.current = null
                    seatDragOriginRef.current?.visible(false)
                    seatDragPreviewRef.current?.visible(false)
                    seatDragOriginRef.current?.getLayer()?.batchDraw()
                    onSeatDragEnd?.(person.id, canvasX, canvasY)
                  }}
                />
              ))
            })}
          </Layer>

          {/* Group connection lines between seated members */}
          {groupConnections.length > 0 && (
            <Layer listening={false}>
              {groupConnections.map((conn, i) => (
                <Line
                  key={`gc-${i}`}
                  points={conn.points}
                  stroke={conn.color}
                  strokeWidth={1.5}
                  dash={[4, 4]}
                  opacity={0.5}
                />
              ))}
            </Layer>
          )}

          {/* Drag-over highlight */}
          {highlightTableId && (
            <Layer listening={false}>
              {tables
                .filter((t) => t.id === highlightTableId)
                .map((table) => (
                  <Rect
                    key={`hl-${table.id}`}
                    x={table.x}
                    y={table.y}
                    width={table.width + 12}
                    height={table.height + 12}
                    offsetX={(table.width + 12) / 2}
                    offsetY={(table.height + 12) / 2}
                    rotation={table.rotation}
                    cornerRadius={10}
                    fill="rgba(200, 169, 110, 0.15)"
                    stroke="rgba(200, 169, 110, 0.6)"
                    strokeWidth={2}
                    dash={[6, 4]}
                  />
                ))}
            </Layer>
          )}

          {/* Seat placement preview (group drag-over) */}
          {previewSeats && previewSeats.length > 0 && (
            <Layer listening={false}>
              {previewSeats.map((ps, i) => {
                const fill = ps.color
                  ? `${ps.color}40`
                  : "rgba(200, 169, 110, 0.25)"
                const stroke = ps.color
                  ? `${ps.color}90`
                  : "rgba(200, 169, 110, 0.6)"
                return (
                  <Group key={`preview-${i}`} x={ps.x} y={ps.y}>
                    <Circle
                      radius={SEAT_RADIUS}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={1.5}
                      dash={[4, 3]}
                    />
                    <Text
                      text={ps.initials}
                      fontSize={10}
                      fill="rgba(232, 228, 220, 0.8)"
                      align="center"
                      verticalAlign="middle"
                      width={SEAT_RADIUS * 2}
                      height={SEAT_RADIUS * 2}
                      offsetX={SEAT_RADIUS}
                      offsetY={SEAT_RADIUS}
                      fontFamily="IBM Plex Mono"
                    />
                  </Group>
                )
              })}
            </Layer>
          )}

          {/* Seat drag: origin empty seat + target preview (imperatively controlled) */}
          <Layer listening={false}>
            {/* Static empty seat at drag origin */}
            <Group ref={seatDragOriginRef} visible={false}>
              <Circle
                radius={SEAT_RADIUS}
                fill={TABLE_COLORS.seatFill}
                stroke={TABLE_COLORS.seatStroke}
                strokeWidth={1}
              />
              <Text
                text=""
                fontSize={9}
                fill={TABLE_COLORS.text}
                align="center"
                verticalAlign="middle"
                width={SEAT_RADIUS * 2}
                height={SEAT_RADIUS * 2}
                offsetX={SEAT_RADIUS}
                offsetY={SEAT_RADIUS}
                fontFamily="IBM Plex Mono"
              />
            </Group>
            {/* Preview on target seat */}
            <Group ref={seatDragPreviewRef} visible={false}>
              <Circle
                radius={SEAT_RADIUS}
                fill="rgba(200, 169, 110, 0.25)"
                stroke="rgba(200, 169, 110, 0.6)"
                strokeWidth={1.5}
                dash={[4, 3]}
              />
              <Text
                text=""
                fontSize={10}
                fill="rgba(232, 228, 220, 0.8)"
                align="center"
                verticalAlign="middle"
                width={SEAT_RADIUS * 2}
                height={SEAT_RADIUS * 2}
                offsetX={SEAT_RADIUS}
                offsetY={SEAT_RADIUS}
                fontFamily="IBM Plex Mono"
              />
            </Group>
          </Layer>

          {/* Expand buttons */}
          <Layer>
            {isEditMode &&
              toolMode === "pointer" &&
              expandTargetTable &&
              expandButtons.map((btn) => (
                <ExpandButtonComponent
                  key={btn.dir}
                  btn={btn}
                  onClick={() => {
                    const newId = expandTable(
                      expandTargetTable.id,
                      btn.dir,
                      btn.newTableX,
                      btn.newTableY
                    )
                    if (newId) selectTable(newId)
                  }}
                  onHoverEnter={() => hoverEnter(expandTargetTable.id)}
                  onHoverLeave={hoverLeave}
                />
              ))}
          </Layer>

          {/* Snap guides */}
          <Layer listening={false}>
            {snapGuides.map((g, i) =>
              g.orientation === "V" ? (
                <Line
                  key={`sg-${i}`}
                  points={[g.pos, g.start, g.pos, g.end]}
                  stroke={GUIDE_COLOR}
                  strokeWidth={1}
                  dash={[6, 4]}
                />
              ) : (
                <Line
                  key={`sg-${i}`}
                  points={[g.start, g.pos, g.end, g.pos]}
                  stroke={GUIDE_COLOR}
                  strokeWidth={1}
                  dash={[6, 4]}
                />
              )
            )}
            {/* In-progress polygon preview */}
            {polygonPoints.length >= 2 && (
              <Line
                points={polygonPoints}
                stroke="rgba(200, 169, 110, 0.6)"
                strokeWidth={1}
                dash={[4, 4]}
                closed={false}
              />
            )}
            {/* In-progress line preview */}
            {drawStart && toolMode === "draw-line" && (
              <Line
                points={[drawStart.x, drawStart.y, drawStart.x + 1, drawStart.y + 1]}
                stroke="rgba(200, 169, 110, 0.4)"
                strokeWidth={1}
                dash={[4, 4]}
              />
            )}
          </Layer>
        </Stage>

        {/* HTML overlay: edge selector */}
        {isEditMode && selectedTable && toolMode === "pointer" && (
          <div className="pointer-events-none absolute inset-0" style={{ top: 0 }}>
            <div className="pointer-events-auto">
              <EdgeSelector
                table={selectedTable}
                stageRef={stageRef}
                scale={scale}
                position={position}
                onEdgeChange={handleEdgeChange}
              />
            </div>
          </div>
        )}

        {/* HTML overlay: seat tooltip */}
        {seatTooltip && (
          <div
            className="pointer-events-auto absolute z-20 -translate-x-1/2 -translate-y-full"
            style={{
              left: seatTooltip.canvasX * scale + position.x,
              top: seatTooltip.canvasY * scale + position.y - 24,
            }}
          >
            <div className="flex items-center gap-1.5 rounded-lg bg-popover px-3 py-2 text-popover-foreground shadow-lg ring-1 ring-border">
              <span className="text-sm font-medium whitespace-nowrap">{seatTooltip.personName}</span>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => {
                  onUnseat?.(seatTooltip.personId)
                  setSeatTooltip(null)
                }}
              >
                <UserXIcon className="size-3.5" />
                {t("delete")}
              </button>
              <button
                type="button"
                className="ml-0.5 rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSeatTooltip(null)}
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Drawing toolbar (bottom-left on desktop, above mobile toolbar on mobile) */}
        {showDrawingTools && (
          <div className="absolute bottom-3 left-3 flex flex-col gap-2 md:bottom-3">
            <DrawingToolbar
              toolMode={toolMode}
              onToolModeChange={(m) => {
                setToolMode(m)
                setDrawStart(null)
                setPolygonPoints([])
              }}
              hasSelectedShape={!!selectedShapeId}
              onDeleteShape={() => {
                if (selectedShapeId) {
                  removeShape(selectedShapeId)
                  setSelectedShapeId(null)
                }
              }}
            />
            {selectedShape && (
              <ShapeProperties
                shape={selectedShape}
                onUpdate={(id, updates) => updateShape(id, updates)}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile: bottom toolbar */}
      {isEditMode && (
        <div className="md:hidden">
          <MobileToolbar
            canUndo={undoRedo.canUndo}
            canRedo={undoRedo.canRedo}
            hasSelected={!!selectedTableId || !!selectedShapeId}
            scale={scale}
            onUndo={undoRedo.undo}
            onRedo={undoRedo.redo}
            onAddTable={handleAddTable}
            onDeleteSelected={handleDeleteSelected}
            onZoomIn={() => setScale((s) => Math.min(s * 1.2, MAX_SCALE))}
            onZoomOut={() => setScale((s) => Math.max(s / 1.2, MIN_SCALE))}
            onFitToView={fitToView}
          />
        </div>
      )}

      {/* Long-press context menu for tables */}
      <TableContextMenu
        table={contextMenuTable}
        open={!!contextMenuTableId}
        onOpenChange={(open) => { if (!open) setContextMenuTableId(null) }}
        onRename={(label) => {
          if (!contextMenuTableId) return
          if (label.trim() === "") {
            toast.error("Table name required")
            return
          }
          renameTable(contextMenuTableId, label)
        }}
        onResize={(w, h) => {
          if (contextMenuTableId) resizeTable(contextMenuTableId, w, h)
        }}
        onRotate={() => {
          if (contextMenuTableId) rotateTable(contextMenuTableId)
        }}
        onDelete={() => {
          if (contextMenuTableId) {
            removeTable(contextMenuTableId)
            setContextMenuTableId(null)
            if (selectedTableId === contextMenuTableId) setSelectedTableId(null)
          }
        }}
      />
    </div>
  )
}
