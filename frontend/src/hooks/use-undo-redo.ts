"use client"

import { useRef, useCallback, useState } from "react"

const MAX_HISTORY = 50

export interface UndoRedoControls<T> {
  set: (state: T) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

/**
 * Generic undo/redo history stack.
 * Wraps an external state setter — every call to `set()` pushes to history.
 */
export function useUndoRedo<T>(
  currentState: T,
  onStateChange: (state: T) => void
): UndoRedoControls<T> {
  const pastRef = useRef<T[]>([])
  const futureRef = useRef<T[]>([])
  const [, forceUpdate] = useState(0)

  const set = useCallback(
    (newState: T) => {
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), currentState]
      futureRef.current = []
      onStateChange(newState)
      forceUpdate((n) => n + 1)
    },
    [currentState, onStateChange]
  )

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return
    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current, currentState]
    onStateChange(prev)
    forceUpdate((n) => n + 1)
  }, [currentState, onStateChange])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    pastRef.current = [...pastRef.current, currentState]
    onStateChange(next)
    forceUpdate((n) => n + 1)
  }, [currentState, onStateChange])

  return {
    set,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  }
}
