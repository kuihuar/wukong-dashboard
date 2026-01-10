package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kuihuar/wukong-dashboard/go-backend/pkg/k8s"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// VMHandler handles VM-related HTTP requests
type VMHandler struct {
	client *k8s.Client
}

// NewVMHandler creates a new VM handler
func NewVMHandler(client *k8s.Client) *VMHandler {
	return &VMHandler{client: client}
}

// ListVMs handles GET /api/vms
func (h *VMHandler) ListVMs(c *gin.Context) {
	ctx := c.Request.Context()

	wukongs, err := h.client.ListWukongs(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list VMs: " + err.Error(),
		})
		return
	}

	var vms []*k8s.VMInfo
	for _, w := range wukongs {
		obj := &unstructured.Unstructured{Object: w}
		vms = append(vms, k8s.ConvertWukongToVMInfo(obj))
	}

	c.JSON(http.StatusOK, vms)
}

// GetVM handles GET /api/vms/:name
func (h *VMHandler) GetVM(c *gin.Context) {
	name := c.Param("name")
	ctx := c.Request.Context()

	wukong, err := h.client.GetWukong(ctx, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "VM not found: " + err.Error(),
		})
		return
	}

	vm := k8s.ConvertWukongToVMInfo(wukong)
	c.JSON(http.StatusOK, vm)
}

// CreateVMRequest represents the request body for creating a VM
type CreateVMRequest struct {
	Name     string                   `json:"name" binding:"required"`
	CPU      int64                    `json:"cpu" binding:"required,min=1,max=64"`
	Memory   string                   `json:"memory" binding:"required"`
	OSImage  string                   `json:"osImage" binding:"required"`
	Networks []map[string]interface{} `json:"networks"`
	Disks    []map[string]interface{} `json:"disks" binding:"required"`
	GPUs     []map[string]interface{} `json:"gpus,omitempty"`
}

// CreateVM handles POST /api/vms
func (h *VMHandler) CreateVM(c *gin.Context) {
	var req CreateVMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	ctx := c.Request.Context()

	// Build spec
	spec := map[string]interface{}{
		"cpu":     req.CPU,
		"memory":  req.Memory,
		"osImage": req.OSImage,
		"running": true,
	}

	if len(req.Networks) > 0 {
		spec["networks"] = req.Networks
	}
	if len(req.Disks) > 0 {
		spec["disks"] = req.Disks
	}
	if len(req.GPUs) > 0 {
		spec["gpus"] = req.GPUs
	}

	// Get namespace from query or use default
	namespace := c.DefaultQuery("namespace", "default")
	wukong := k8s.BuildWukongObject(req.Name, namespace, spec)

	created, err := h.client.CreateWukong(ctx, wukong)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create VM: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"id":      string(created.GetUID()),
		"name":    created.GetName(),
		"message": "Virtual machine created successfully",
	})
}

// VMActionRequest represents the request body for VM actions
type VMActionRequest struct {
	Action string `json:"action" binding:"required,oneof=start stop restart delete"`
}

// VMAction handles POST /api/vms/:name/action
func (h *VMHandler) VMAction(c *gin.Context) {
	name := c.Param("name")
	var req VMActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	ctx := c.Request.Context()
	var err error
	var message string

	switch req.Action {
	case "start":
		err = h.client.StartVM(ctx, name)
		message = "Virtual machine started"
	case "stop":
		err = h.client.StopVM(ctx, name)
		message = "Virtual machine stopped"
	case "restart":
		err = h.client.RestartVM(ctx, name)
		message = "Virtual machine restarted"
	case "delete":
		err = h.client.DeleteWukong(ctx, name)
		message = "Virtual machine deleted"
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Action failed: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": message,
	})
}

// GetVMStats handles GET /api/vms/stats
func (h *VMHandler) GetVMStats(c *gin.Context) {
	ctx := c.Request.Context()

	wukongs, err := h.client.ListWukongs(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get stats: " + err.Error(),
		})
		return
	}

	stats := struct {
		Total       int    `json:"total"`
		Running     int    `json:"running"`
		Stopped     int    `json:"stopped"`
		Error       int    `json:"error"`
		Pending     int    `json:"pending"`
		TotalCPU    int64  `json:"totalCpu"`
		TotalMemory string `json:"totalMemory"`
	}{}

	var totalMemoryGi int64
	for _, w := range wukongs {
		obj := &unstructured.Unstructured{Object: w}
		vm := k8s.ConvertWukongToVMInfo(obj)

		stats.Total++
		stats.TotalCPU += vm.CPU

		// Parse memory (assuming format like "8Gi")
		var memGi int64
		if len(vm.Memory) > 2 {
			// Simple parsing, assumes Gi suffix
			memStr := vm.Memory[:len(vm.Memory)-2]
			for _, c := range memStr {
				if c >= '0' && c <= '9' {
					memGi = memGi*10 + int64(c-'0')
				}
			}
		}
		totalMemoryGi += memGi

		switch vm.Status {
		case "Running":
			stats.Running++
		case "Stopped":
			stats.Stopped++
		case "Error", "Failed":
			stats.Error++
		case "Pending", "Scheduling", "Creating":
			stats.Pending++
		}
	}

	stats.TotalMemory = string(rune(totalMemoryGi)) + "Gi"

	c.JSON(http.StatusOK, stats)
}
