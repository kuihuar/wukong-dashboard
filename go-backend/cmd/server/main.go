package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kuihuar/wukong-dashboard/go-backend/pkg/handlers"
	"github.com/kuihuar/wukong-dashboard/go-backend/pkg/k8s"
	"github.com/kuihuar/wukong-dashboard/go-backend/pkg/vnc"
	"github.com/kuihuar/wukong-dashboard/go-backend/pkg/websocket"
)

func main() {
	// Get configuration from environment
	namespace := getEnv("NAMESPACE", "default")
	port := getEnv("PORT", "8085")
	mode := getEnv("GIN_MODE", "release")

	gin.SetMode(mode)

	// Initialize Kubernetes client
	k8sClient, err := k8s.NewClient(namespace)
	if err != nil {
		log.Fatalf("Failed to create Kubernetes client: %v", err)
	}
	log.Printf("Connected to Kubernetes cluster, watching namespace: %s", namespace)

	// Initialize handlers
	vmHandler := handlers.NewVMHandler(k8sClient)
	snapshotHandler := handlers.NewSnapshotHandler(k8sClient)
	vncProxy := vnc.NewVNCProxy(k8sClient, namespace)

	// Initialize WebSocket hub
	wsHub := websocket.NewHub(k8sClient)
	wsHandler := handlers.NewWebSocketHandler(wsHub)

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start WebSocket hub
	go wsHub.Run(ctx)

	// Setup router
	router := gin.Default()

	// CORS middleware
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// API routes
	api := router.Group("/api")
	{
		// VM routes
		vms := api.Group("/vms")
		{
			vms.GET("", vmHandler.ListVMs)
			vms.GET("/stats", vmHandler.GetVMStats)
			vms.POST("", vmHandler.CreateVM)
			vms.GET("/:name", vmHandler.GetVM)
			vms.POST("/:name/action", vmHandler.VMAction)
			vms.GET("/:name/snapshots", snapshotHandler.ListSnapshotsByVM)

			// VNC routes
			vms.GET("/:name/vnc", vncProxy.HandleVNC)
			vms.GET("/:name/vnc/info", vncProxy.GetVNCInfo)
		}

		// Snapshot routes
		snapshots := api.Group("/snapshots")
		{
			snapshots.GET("", snapshotHandler.ListSnapshots)
			snapshots.POST("", snapshotHandler.CreateSnapshot)
			snapshots.POST("/:name/restore", snapshotHandler.RestoreSnapshot)
			snapshots.DELETE("/:name", snapshotHandler.DeleteSnapshot)
		}

		// WebSocket route for real-time updates
		api.GET("/ws", wsHandler.HandleWebSocket)
	}

	// Create HTTP server
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Wukong Dashboard Go Backend starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Cancel context to stop WebSocket hub
	cancel()

	// Graceful shutdown with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
