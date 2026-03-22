"use client"

import { useEffect } from "react"

interface KeyboardShortcutOptions {
  onUndo?: () => void
  onRedo?: () => void
  onDelete?: () => void
  onEscape?: () => void
}

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  onDelete,
  onEscape,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault()
        onRedo?.()
        return
      }

      if (isMod && e.key.toLowerCase() === "z") {
        e.preventDefault()
        onUndo?.()
        return
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        onDelete?.()
        return
      }

      if (e.key === "Escape") {
        onEscape?.()
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onUndo, onRedo, onDelete, onEscape])
}
