package handler

import (
	"bufio"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
)

type SSEHandler struct {
	mu      sync.RWMutex
	clients map[string]map[chan SSEEvent]struct{}
}

type SSEEvent struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

func NewSSEHandler() *SSEHandler {
	return &SSEHandler{
		clients: make(map[string]map[chan SSEEvent]struct{}),
	}
}

func (h *SSEHandler) Broadcast(eventID string, eventType string, data any) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	clients, ok := h.clients[eventID]
	if !ok {
		return
	}

	event := SSEEvent{Type: eventType, Data: data}
	for ch := range clients {
		select {
		case ch <- event:
		default:
			// Drop if client is slow
		}
	}
}

func (h *SSEHandler) Stream(c *fiber.Ctx) error {
	eventID := c.Params("id")

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	ch := make(chan SSEEvent, 32)

	h.mu.Lock()
	if _, ok := h.clients[eventID]; !ok {
		h.clients[eventID] = make(map[chan SSEEvent]struct{})
	}
	h.clients[eventID][ch] = struct{}{}
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.clients[eventID], ch)
		if len(h.clients[eventID]) == 0 {
			delete(h.clients, eventID)
		}
		h.mu.Unlock()
		close(ch)
	}()

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		// Send initial connection event
		fmt.Fprintf(w, "event: connected\ndata: {}\n\n")
		w.Flush()

		for event := range ch {
			data, err := json.Marshal(event.Data)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, string(data))
			if err := w.Flush(); err != nil {
				return
			}
		}
	})

	return nil
}

// Adapt fasthttp stream writer to the interface Fiber expects
func init() {
	// Ensure fasthttp is available (compile-time check)
	_ = fasthttp.StatusOK
}
