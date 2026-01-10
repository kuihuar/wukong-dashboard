package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kuihuar/wukong-dashboard/go-backend/pkg/k8s"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// SnapshotHandler handles snapshot-related HTTP requests
type SnapshotHandler struct {
	client *k8s.Client
}

// NewSnapshotHandler creates a new snapshot handler
func NewSnapshotHandler(client *k8s.Client) *SnapshotHandler {
	return &SnapshotHandler{client: client}
}

// ListSnapshots handles GET /api/snapshots
func (h *SnapshotHandler) ListSnapshots(c *gin.Context) {
	ctx := c.Request.Context()

	snapshots, err := h.client.ListSnapshots(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list snapshots: " + err.Error(),
		})
		return
	}

	var result []*k8s.SnapshotInfo
	for _, s := range snapshots {
		obj := &unstructured.Unstructured{Object: s}
		result = append(result, k8s.ConvertSnapshotToInfo(obj))
	}

	c.JSON(http.StatusOK, result)
}

// ListSnapshotsByVM handles GET /api/vms/:name/snapshots
func (h *SnapshotHandler) ListSnapshotsByVM(c *gin.Context) {
	vmName := c.Param("name")
	ctx := c.Request.Context()

	snapshots, err := h.client.ListSnapshots(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list snapshots: " + err.Error(),
		})
		return
	}

	var result []*k8s.SnapshotInfo
	for _, s := range snapshots {
		obj := &unstructured.Unstructured{Object: s}
		info := k8s.ConvertSnapshotToInfo(obj)
		if info.WukongName == vmName {
			result = append(result, info)
		}
	}

	c.JSON(http.StatusOK, result)
}

// CreateSnapshotRequest represents the request body for creating a snapshot
type CreateSnapshotRequest struct {
	Name       string `json:"name" binding:"required"`
	WukongName string `json:"wukongName" binding:"required"`
}

// CreateSnapshot handles POST /api/snapshots
func (h *SnapshotHandler) CreateSnapshot(c *gin.Context) {
	var req CreateSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	ctx := c.Request.Context()
	namespace := c.DefaultQuery("namespace", "default")

	// Verify the VM exists
	_, err := h.client.GetWukong(ctx, req.WukongName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Virtual machine not found: " + err.Error(),
		})
		return
	}

	snapshot := k8s.BuildSnapshotObject(req.Name, namespace, req.WukongName)
	created, err := h.client.CreateSnapshot(ctx, snapshot)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create snapshot: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"id":      string(created.GetUID()),
		"name":    created.GetName(),
		"message": "Snapshot created successfully",
	})
}

// RestoreSnapshotRequest represents the request body for restoring a snapshot
type RestoreSnapshotRequest struct {
	NewVMName string `json:"newVmName,omitempty"`
}

// RestoreSnapshot handles POST /api/snapshots/:name/restore
func (h *SnapshotHandler) RestoreSnapshot(c *gin.Context) {
	snapshotName := c.Param("name")
	var req RestoreSnapshotRequest
	c.ShouldBindJSON(&req) // Optional binding

	ctx := c.Request.Context()

	// Get the snapshot to find the original VM
	snapshots, err := h.client.ListSnapshots(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get snapshot: " + err.Error(),
		})
		return
	}

	var targetSnapshot *k8s.SnapshotInfo
	for _, s := range snapshots {
		obj := &unstructured.Unstructured{Object: s}
		info := k8s.ConvertSnapshotToInfo(obj)
		if obj.GetName() == snapshotName {
			targetSnapshot = info
			break
		}
	}

	if targetSnapshot == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Snapshot not found",
		})
		return
	}

	// Get the original VM spec
	originalVM, err := h.client.GetWukong(ctx, targetSnapshot.WukongName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Original VM not found: " + err.Error(),
		})
		return
	}

	// Create a new VM from the snapshot
	newName := req.NewVMName
	if newName == "" {
		newName = targetSnapshot.WukongName + "-restored"
	}

	spec, _, _ := unstructured.NestedMap(originalVM.Object, "spec")
	spec["restoreFromSnapshot"] = snapshotName

	namespace := c.DefaultQuery("namespace", "default")
	newVM := k8s.BuildWukongObject(newName, namespace, spec)

	created, err := h.client.CreateWukong(ctx, newVM)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to restore from snapshot: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"id":      string(created.GetUID()),
		"name":    created.GetName(),
		"message": "VM restored from snapshot successfully",
	})
}

// DeleteSnapshot handles DELETE /api/snapshots/:name
func (h *SnapshotHandler) DeleteSnapshot(c *gin.Context) {
	name := c.Param("name")
	ctx := c.Request.Context()

	err := h.client.DeleteSnapshot(ctx, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete snapshot: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Snapshot deleted successfully",
	})
}
