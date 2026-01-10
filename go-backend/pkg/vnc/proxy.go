package vnc

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/kuihuar/wukong-dashboard/go-backend/pkg/k8s"
	"k8s.io/client-go/rest"
)

// VNCProxy handles VNC WebSocket proxying to KubeVirt VMIs
type VNCProxy struct {
	k8sClient  *k8s.Client
	restConfig *rest.Config
	namespace  string
}

// NewVNCProxy creates a new VNC proxy
func NewVNCProxy(k8sClient *k8s.Client, namespace string) *VNCProxy {
	return &VNCProxy{
		k8sClient:  k8sClient,
		restConfig: k8sClient.GetRestConfig(),
		namespace:  namespace,
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for VNC
	},
	Subprotocols: []string{"binary"},
}

// HandleVNC handles VNC WebSocket proxy requests
// Route: GET /api/vms/:name/vnc
func (p *VNCProxy) HandleVNC(c *gin.Context) {
	vmName := c.Param("name")
	ctx := c.Request.Context()

	// Verify VMI exists and is running
	vmi, err := p.k8sClient.GetVMI(ctx, vmName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "VMI not found or not running: " + err.Error(),
		})
		return
	}

	// Check VMI phase
	phase, _, _ := vmi.Object["status"].(map[string]interface{})["phase"].(string)
	if phase != "Running" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("VMI is not running (current phase: %s)", phase),
		})
		return
	}

	// Upgrade to WebSocket
	clientConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade client connection: %v", err)
		return
	}
	defer clientConn.Close()

	// Build KubeVirt VNC WebSocket URL
	vncURL, err := p.buildVNCURL(vmName)
	if err != nil {
		log.Printf("Failed to build VNC URL: %v", err)
		clientConn.WriteMessage(websocket.CloseMessage, 
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Failed to build VNC URL"))
		return
	}

	// Connect to KubeVirt VNC WebSocket
	serverConn, err := p.connectToKubeVirt(ctx, vncURL)
	if err != nil {
		log.Printf("Failed to connect to KubeVirt VNC: %v", err)
		clientConn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Failed to connect to VNC"))
		return
	}
	defer serverConn.Close()

	log.Printf("VNC proxy established for VM: %s", vmName)

	// Bidirectional proxy
	var wg sync.WaitGroup
	wg.Add(2)

	// Client -> Server
	go func() {
		defer wg.Done()
		p.proxyMessages(clientConn, serverConn, "client->server")
	}()

	// Server -> Client
	go func() {
		defer wg.Done()
		p.proxyMessages(serverConn, clientConn, "server->client")
	}()

	wg.Wait()
	log.Printf("VNC proxy closed for VM: %s", vmName)
}

// buildVNCURL builds the KubeVirt VNC WebSocket URL
func (p *VNCProxy) buildVNCURL(vmName string) (string, error) {
	// KubeVirt VNC endpoint format:
	// wss://<api-server>/apis/subresources.kubevirt.io/v1/namespaces/<namespace>/virtualmachineinstances/<name>/vnc
	
	host := p.restConfig.Host
	if !strings.HasPrefix(host, "https://") && !strings.HasPrefix(host, "http://") {
		host = "https://" + host
	}

	// Parse and rebuild as WebSocket URL
	u, err := url.Parse(host)
	if err != nil {
		return "", err
	}

	scheme := "wss"
	if u.Scheme == "http" {
		scheme = "ws"
	}

	vncPath := fmt.Sprintf("/apis/subresources.kubevirt.io/v1/namespaces/%s/virtualmachineinstances/%s/vnc",
		p.namespace, vmName)

	vncURL := fmt.Sprintf("%s://%s%s", scheme, u.Host, vncPath)
	return vncURL, nil
}

// connectToKubeVirt establishes a WebSocket connection to KubeVirt VNC endpoint
func (p *VNCProxy) connectToKubeVirt(ctx context.Context, vncURL string) (*websocket.Conn, error) {
	// Build TLS config from rest config
	tlsConfig := &tls.Config{
		InsecureSkipVerify: p.restConfig.TLSClientConfig.Insecure,
	}

	if p.restConfig.TLSClientConfig.CAData != nil {
		// In production, properly configure CA certificates
		tlsConfig.InsecureSkipVerify = true // Simplified for demo
	}

	dialer := websocket.Dialer{
		TLSClientConfig:  tlsConfig,
		HandshakeTimeout: 10 * time.Second,
		Subprotocols:     []string{"binary"},
	}

	// Build headers with authentication
	headers := http.Header{}
	if p.restConfig.BearerToken != "" {
		headers.Set("Authorization", "Bearer "+p.restConfig.BearerToken)
	}

	conn, resp, err := dialer.DialContext(ctx, vncURL, headers)
	if err != nil {
		if resp != nil {
			body, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("dial failed: %v, response: %s", err, string(body))
		}
		return nil, err
	}

	return conn, nil
}

// proxyMessages proxies WebSocket messages between two connections
func (p *VNCProxy) proxyMessages(src, dst *websocket.Conn, direction string) {
	for {
		messageType, data, err := src.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("VNC proxy %s read error: %v", direction, err)
			}
			return
		}

		err = dst.WriteMessage(messageType, data)
		if err != nil {
			log.Printf("VNC proxy %s write error: %v", direction, err)
			return
		}
	}
}

// GetVNCInfo returns VNC connection information for a VM
// Route: GET /api/vms/:name/vnc/info
func (p *VNCProxy) GetVNCInfo(c *gin.Context) {
	vmName := c.Param("name")
	ctx := c.Request.Context()

	// Check if VMI exists and is running
	vmi, err := p.k8sClient.GetVMI(ctx, vmName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"available": false,
			"error":     "VMI not found or not running",
		})
		return
	}

	phase, _, _ := vmi.Object["status"].(map[string]interface{})["phase"].(string)
	
	c.JSON(http.StatusOK, gin.H{
		"available": phase == "Running",
		"vmName":    vmName,
		"phase":     phase,
		"wsUrl":     fmt.Sprintf("/api/vms/%s/vnc", vmName),
	})
}
