package websocket

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kuihuar/wukong-dashboard/go-backend/pkg/k8s"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/watch"
)

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	k8sClient  *k8s.Client
	mu         sync.RWMutex
}

// Client represents a WebSocket client
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

// Message represents a WebSocket message
type Message struct {
	Type      string      `json:"type"`
	Resource  string      `json:"resource"`
	Action    string      `json:"action"`
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
}

// NewHub creates a new Hub
func NewHub(k8sClient *k8s.Client) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		k8sClient:  k8sClient,
	}
}

// Run starts the hub
func (h *Hub) Run(ctx context.Context) {
	// Start Kubernetes watchers
	go h.watchWukongs(ctx)
	go h.watchSnapshots(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("Client connected. Total clients: %d", len(h.clients))
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("Client disconnected. Total clients: %d", len(h.clients))
		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// watchWukongs watches for Wukong resource changes
func (h *Hub) watchWukongs(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		watcher, err := h.k8sClient.WatchWukongs(ctx)
		if err != nil {
			log.Printf("Failed to watch Wukongs: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		h.handleWatch(ctx, watcher, "vm")
		watcher.Stop()
	}
}

// watchSnapshots watches for WukongSnapshot resource changes
func (h *Hub) watchSnapshots(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		watcher, err := h.k8sClient.WatchSnapshots(ctx)
		if err != nil {
			log.Printf("Failed to watch Snapshots: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		h.handleWatch(ctx, watcher, "snapshot")
		watcher.Stop()
	}
}

// handleWatch processes watch events
func (h *Hub) handleWatch(ctx context.Context, watcher watch.Interface, resourceType string) {
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-watcher.ResultChan():
			if !ok {
				return
			}

			var data interface{}
			if obj, ok := event.Object.(*unstructured.Unstructured); ok {
				if resourceType == "vm" {
					data = k8s.ConvertWukongToVMInfo(obj)
				} else {
					data = k8s.ConvertSnapshotToInfo(obj)
				}
			}

			msg := Message{
				Type:      "update",
				Resource:  resourceType,
				Action:    string(event.Type),
				Data:      data,
				Timestamp: time.Now().UnixMilli(),
			}

			jsonMsg, err := json.Marshal(msg)
			if err != nil {
				log.Printf("Failed to marshal message: %v", err)
				continue
			}

			h.broadcast <- jsonMsg
		}
	}
}

// Broadcast sends a message to all clients
func (h *Hub) Broadcast(msg Message) {
	jsonMsg, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal broadcast message: %v", err)
		return
	}
	h.broadcast <- jsonMsg
}

// Register registers a new client
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister unregisters a client
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// NewClient creates a new WebSocket client
func NewClient(hub *Hub, conn *websocket.Conn) *Client {
	return &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
	}
}

// ReadPump pumps messages from the WebSocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
	}
}

// WritePump pumps messages from the hub to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current WebSocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
