package k8s

import (
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// VMInfo represents a simplified view of a Wukong VM
type VMInfo struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Namespace   string       `json:"namespace"`
	Status      string       `json:"status"`
	CPU         int64        `json:"cpu"`
	Memory      string       `json:"memory"`
	NodeName    string       `json:"nodeName"`
	IPAddress   string       `json:"ipAddress"`
	OSImage     string       `json:"osImage"`
	CreatedAt   int64        `json:"createdAt"`
	HasGPU      bool         `json:"hasGpu"`
	Networks    []NetworkInfo `json:"networks"`
	Disks       []DiskInfo    `json:"disks"`
	GPUs        []GPUInfo     `json:"gpus"`
	Metrics     *MetricsInfo  `json:"metrics,omitempty"`
}

// NetworkInfo represents network configuration
type NetworkInfo struct {
	Name       string `json:"name"`
	Interface  string `json:"interface"`
	IPAddress  string `json:"ipAddress"`
	MACAddress string `json:"macAddress"`
	Mode       string `json:"mode"`
}

// DiskInfo represents disk configuration
type DiskInfo struct {
	Name             string `json:"name"`
	Size             string `json:"size"`
	StorageClassName string `json:"storageClassName"`
	Boot             bool   `json:"boot"`
	Image            string `json:"image,omitempty"`
}

// GPUInfo represents GPU configuration
type GPUInfo struct {
	Name       string `json:"name"`
	DeviceName string `json:"deviceName"`
}

// MetricsInfo represents VM metrics
type MetricsInfo struct {
	CPUUsage    int `json:"cpuUsage"`    // Percentage (0-100)
	MemoryUsage int `json:"memoryUsage"` // Percentage (0-100)
	DiskUsage   int `json:"diskUsage"`   // Percentage (0-100)
}

// SnapshotInfo represents a simplified view of a WukongSnapshot
type SnapshotInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	WukongID   string `json:"wukongId"`
	WukongName string `json:"wukongName"`
	Status     string `json:"status"`
	Size       string `json:"size"`
	CreatedAt  int64  `json:"createdAt"`
}

// ConvertWukongToVMInfo converts an unstructured Wukong to VMInfo
func ConvertWukongToVMInfo(obj *unstructured.Unstructured) *VMInfo {
	spec, _, _ := unstructured.NestedMap(obj.Object, "spec")
	status, _, _ := unstructured.NestedMap(obj.Object, "status")

	vm := &VMInfo{
		ID:        string(obj.GetUID()),
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		CreatedAt: obj.GetCreationTimestamp().UnixMilli(),
	}

	// Extract spec fields
	if cpu, ok, _ := unstructured.NestedInt64(spec, "cpu"); ok {
		vm.CPU = cpu
	}
	if memory, ok, _ := unstructured.NestedString(spec, "memory"); ok {
		vm.Memory = memory
	}
	if osImage, ok, _ := unstructured.NestedString(spec, "osImage"); ok {
		vm.OSImage = osImage
	}

	// Extract networks
	if networks, ok, _ := unstructured.NestedSlice(spec, "networks"); ok {
		for _, n := range networks {
			if netMap, ok := n.(map[string]interface{}); ok {
				netInfo := NetworkInfo{
					Name: getStringField(netMap, "name"),
					Mode: getStringField(netMap, "mode"),
				}
				vm.Networks = append(vm.Networks, netInfo)
			}
		}
	}

	// Extract disks
	if disks, ok, _ := unstructured.NestedSlice(spec, "disks"); ok {
		for _, d := range disks {
			if diskMap, ok := d.(map[string]interface{}); ok {
				diskInfo := DiskInfo{
					Name:             getStringField(diskMap, "name"),
					Size:             getStringField(diskMap, "size"),
					StorageClassName: getStringField(diskMap, "storageClassName"),
					Boot:             getBoolField(diskMap, "boot"),
					Image:            getStringField(diskMap, "image"),
				}
				vm.Disks = append(vm.Disks, diskInfo)
			}
		}
	}

	// Extract GPUs
	if gpus, ok, _ := unstructured.NestedSlice(spec, "gpus"); ok {
		for _, g := range gpus {
			if gpuMap, ok := g.(map[string]interface{}); ok {
				gpuInfo := GPUInfo{
					Name:       getStringField(gpuMap, "name"),
					DeviceName: getStringField(gpuMap, "deviceName"),
				}
				vm.GPUs = append(vm.GPUs, gpuInfo)
			}
		}
		vm.HasGPU = len(vm.GPUs) > 0
	}

	// Extract status fields
	if status != nil {
		if phase, ok, _ := unstructured.NestedString(status, "phase"); ok {
			vm.Status = phase
		}
		if nodeName, ok, _ := unstructured.NestedString(status, "nodeName"); ok {
			vm.NodeName = nodeName
		}

		// Extract network status for IP addresses
		if networkStatus, ok, _ := unstructured.NestedSlice(status, "networkStatus"); ok {
			for i, ns := range networkStatus {
				if nsMap, ok := ns.(map[string]interface{}); ok {
					if i < len(vm.Networks) {
						vm.Networks[i].IPAddress = getStringField(nsMap, "ipAddress")
						vm.Networks[i].MACAddress = getStringField(nsMap, "macAddress")
						vm.Networks[i].Interface = getStringField(nsMap, "interface")
					}
					// Set primary IP
					if vm.IPAddress == "" {
						vm.IPAddress = getStringField(nsMap, "ipAddress")
					}
				}
			}
		}
	}

	// Default status if not set
	if vm.Status == "" {
		vm.Status = "Unknown"
	}

	return vm
}

// ConvertSnapshotToInfo converts an unstructured WukongSnapshot to SnapshotInfo
func ConvertSnapshotToInfo(obj *unstructured.Unstructured) *SnapshotInfo {
	spec, _, _ := unstructured.NestedMap(obj.Object, "spec")
	status, _, _ := unstructured.NestedMap(obj.Object, "status")

	snapshot := &SnapshotInfo{
		ID:        string(obj.GetUID()),
		Name:      obj.GetName(),
		CreatedAt: obj.GetCreationTimestamp().UnixMilli(),
	}

	// Extract spec fields
	if wukongName, ok, _ := unstructured.NestedString(spec, "wukongName"); ok {
		snapshot.WukongName = wukongName
		snapshot.WukongID = wukongName // Use name as ID for simplicity
	}

	// Extract status fields
	if status != nil {
		if phase, ok, _ := unstructured.NestedString(status, "phase"); ok {
			snapshot.Status = phase
		}
		if size, ok, _ := unstructured.NestedString(status, "size"); ok {
			snapshot.Size = size
		}
	}

	// Default values
	if snapshot.Status == "" {
		snapshot.Status = "Pending"
	}
	if snapshot.Size == "" {
		snapshot.Size = "0Gi"
	}

	return snapshot
}

// BuildWukongObject builds an unstructured Wukong object for creation
func BuildWukongObject(name, namespace string, spec map[string]interface{}) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "vm.novasphere.dev/v1alpha1",
			"kind":       "Wukong",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": namespace,
			},
			"spec": spec,
		},
	}
}

// BuildSnapshotObject builds an unstructured WukongSnapshot object for creation
func BuildSnapshotObject(name, namespace, wukongName string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "vm.novasphere.dev/v1alpha1",
			"kind":       "WukongSnapshot",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": namespace,
				"creationTimestamp": time.Now().Format(time.RFC3339),
			},
			"spec": map[string]interface{}{
				"wukongName": wukongName,
			},
		},
	}
}

// Helper functions
func getStringField(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getBoolField(m map[string]interface{}, key string) bool {
	if v, ok := m[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}
