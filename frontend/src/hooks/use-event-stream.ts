"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { authClient } from "@/lib/auth"

export type SSEEventType =
  | "connected"
  | "person_created"
  | "person_updated"
  | "person_deleted"
  | "seat_assigned"
  | "person_parked"
  | "seats_swapped"
  | "bulk_assigned"
  | "floorplan_updated"

interface UseEventStreamOptions {
  eventId: string
  onEvent: (type: SSEEventType, data: any) => void
  enabled?: boolean
}

const BASE_DELAY = 1000
const MAX_DELAY = 30000
/** Only show disconnected banner after this many consecutive failures */
const DISCONNECT_THRESHOLD = 3

export function useEventStream({
  eventId,
  onEvent,
  enabled = true,
}: UseEventStreamOptions) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const retryCountRef = useRef(0)
  const esRef = useRef<EventSource | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isConnected, setIsConnected] = useState(true)

  const connect = useCallback(async () => {
    if (!eventId || !enabled) return

    // Get token for SSE (EventSource can't send headers)
    let token = ""
    try {
      const { data, error } = await authClient.$fetch("/token", {
        method: "GET",
      })
      if (!error && data && typeof data === "object" && "token" in data) {
        token = (data as { token: string }).token
      }
    } catch {
      // proceed without token — backend will reject if auth required
    }

    const url = `/api/v1/events/${eventId}/stream${token ? `?token=${token}` : ""}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      retryCountRef.current = 0
      setIsConnected(true)
    }

    const eventTypes: SSEEventType[] = [
      "connected",
      "person_created",
      "person_updated",
      "person_deleted",
      "seat_assigned",
      "person_parked",
      "seats_swapped",
      "bulk_assigned",
      "floorplan_updated",
    ]

    for (const type of eventTypes) {
      es.addEventListener(type, (e) => {
        try {
          const data = JSON.parse(e.data)
          onEventRef.current(type, data)
        } catch {
          onEventRef.current(type, {})
        }
      })
    }

    es.onerror = () => {
      es.close()
      esRef.current = null

      retryCountRef.current++
      // Only show disconnected after several consecutive failures
      if (retryCountRef.current >= DISCONNECT_THRESHOLD) {
        setIsConnected(false)
      }

      const delay = Math.min(BASE_DELAY * Math.pow(2, retryCountRef.current - 1), MAX_DELAY)
      retryTimerRef.current = setTimeout(connect, delay)
    }
  }, [eventId, enabled])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      esRef.current = null
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      retryCountRef.current = 0
    }
  }, [connect])

  return { isConnected }
}
