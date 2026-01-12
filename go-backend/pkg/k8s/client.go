package k8s

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	metricsv "k8s.io/metrics/pkg/client/clientset/versioned"
	corev1 "k8s.io/api/core/v1"
	"encoding/json"
)

// Client wraps Kubernetes client for Wukong and KubeVirt resources
type Client struct {
	clientset     *kubernetes.Clientset
	dynamicClient dynamic.Interface
	metricsClient *metricsv.Clientset
	restConfig    *rest.Config
	namespace     string
}

// WukongGVR is the GroupVersionResource for Wukong CRD
var WukongGVR = schema.GroupVersionResource{
	Group:    "vm.novasphere.dev",
	Version:  "v1alpha1",
	Resource: "wukongs",
}

// WukongSnapshotGVR is the GroupVersionResource for WukongSnapshot CRD
var WukongSnapshotGVR = schema.GroupVersionResource{
	Group:    "vm.novasphere.dev",
	Version:  "v1alpha1",
	Resource: "wukongsnapshots",
}

// VirtualMachineGVR is the GroupVersionResource for KubeVirt VM
var VirtualMachineGVR = schema.GroupVersionResource{
	Group:    "kubevirt.io",
	Version:  "v1",
	Resource: "virtualmachines",
}

// VirtualMachineInstanceGVR is the GroupVersionResource for KubeVirt VMI
var VirtualMachineInstanceGVR = schema.GroupVersionResource{
	Group:    "kubevirt.io",
	Version:  "v1",
	Resource: "virtualmachineinstances",
}

// NewClient creates a new Kubernetes client
func NewClient(namespace string) (*Client, error) {
	config, err := getKubeConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get kubeconfig: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %w", err)
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	metricsClient, err := metricsv.NewForConfig(config)
	if err != nil {
		// Metrics client is optional, log warning but don't fail
		fmt.Printf("Warning: Failed to create metrics client: %v. Metrics will not be available.\n", err)
	}

	return &Client{
		clientset:     clientset,
		dynamicClient: dynamicClient,
		metricsClient: metricsClient,
		restConfig:    config,
		namespace:     namespace,
	}, nil
}

// getKubeConfig returns the Kubernetes config
func getKubeConfig() (*rest.Config, error) {
	// Try in-cluster config first
	config, err := rest.InClusterConfig()
	if err == nil {
		return config, nil
	}

	// Fall back to kubeconfig file
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		home, _ := os.UserHomeDir()
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	return clientcmd.BuildConfigFromFlags("", kubeconfig)
}

// GetRestConfig returns the REST config for VNC proxy
func (c *Client) GetRestConfig() *rest.Config {
	return c.restConfig
}

// ListWukongs lists all Wukong resources
func (c *Client) ListWukongs(ctx context.Context) ([]map[string]interface{}, error) {
	list, err := c.dynamicClient.Resource(WukongGVR).Namespace(c.namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	for _, item := range list.Items {
		results = append(results, item.Object)
	}
	return results, nil
}

// GetWukong gets a specific Wukong resource
func (c *Client) GetWukong(ctx context.Context, name string) (*unstructured.Unstructured, error) {
	return c.dynamicClient.Resource(WukongGVR).Namespace(c.namespace).Get(ctx, name, metav1.GetOptions{})
}

// CreateWukong creates a new Wukong resource
func (c *Client) CreateWukong(ctx context.Context, wukong *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	return c.dynamicClient.Resource(WukongGVR).Namespace(c.namespace).Create(ctx, wukong, metav1.CreateOptions{})
}

// UpdateWukong updates an existing Wukong resource
func (c *Client) UpdateWukong(ctx context.Context, wukong *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	return c.dynamicClient.Resource(WukongGVR).Namespace(c.namespace).Update(ctx, wukong, metav1.UpdateOptions{})
}

// DeleteWukong deletes a Wukong resource
func (c *Client) DeleteWukong(ctx context.Context, name string) error {
	return c.dynamicClient.Resource(WukongGVR).Namespace(c.namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// WatchWukongs watches for Wukong resource changes
func (c *Client) WatchWukongs(ctx context.Context) (watch.Interface, error) {
	return c.dynamicClient.Resource(WukongGVR).Namespace(c.namespace).Watch(ctx, metav1.ListOptions{})
}

// GetVMI gets a VirtualMachineInstance for VNC connection
func (c *Client) GetVMI(ctx context.Context, name string) (*unstructured.Unstructured, error) {
	return c.dynamicClient.Resource(VirtualMachineInstanceGVR).Namespace(c.namespace).Get(ctx, name, metav1.GetOptions{})
}

// GetVMStatus gets the actual VM status from KubeVirt VM resource
// Returns the printableStatus from the VM resource, or empty string if not found
func (c *Client) GetVMStatus(ctx context.Context, vmName string) (string, error) {
	vm, err := c.dynamicClient.Resource(VirtualMachineGVR).Namespace(c.namespace).Get(ctx, vmName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	
	status, _, _ := unstructured.NestedMap(vm.Object, "status")
	if status == nil {
		return "", nil
	}
	
	// Get printableStatus from VM resource
	if printableStatus, ok, _ := unstructured.NestedString(status, "printableStatus"); ok && printableStatus != "" {
		return printableStatus, nil
	}
	
	return "", nil
}

// StartVM starts a virtual machine by patching the running state
func (c *Client) StartVM(ctx context.Context, name string) error {
	wukong, err := c.GetWukong(ctx, name)
	if err != nil {
		return err
	}

	// Set running to true
	if err := unstructured.SetNestedField(wukong.Object, true, "spec", "running"); err != nil {
		return err
	}

	_, err = c.UpdateWukong(ctx, wukong)
	return err
}

// StopVM stops a virtual machine by patching the running state
func (c *Client) StopVM(ctx context.Context, name string) error {
	wukong, err := c.GetWukong(ctx, name)
	if err != nil {
		return err
	}

	// Set running to false
	if err := unstructured.SetNestedField(wukong.Object, false, "spec", "running"); err != nil {
		return err
	}

	_, err = c.UpdateWukong(ctx, wukong)
	return err
}

// RestartVM restarts a virtual machine
func (c *Client) RestartVM(ctx context.Context, name string) error {
	// Stop then start with a small delay
	if err := c.StopVM(ctx, name); err != nil {
		return err
	}
	time.Sleep(2 * time.Second)
	return c.StartVM(ctx, name)
}

// ListSnapshots lists all WukongSnapshot resources
func (c *Client) ListSnapshots(ctx context.Context) ([]map[string]interface{}, error) {
	list, err := c.dynamicClient.Resource(WukongSnapshotGVR).Namespace(c.namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	for _, item := range list.Items {
		results = append(results, item.Object)
	}
	return results, nil
}

// CreateSnapshot creates a new WukongSnapshot resource
func (c *Client) CreateSnapshot(ctx context.Context, snapshot *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	return c.dynamicClient.Resource(WukongSnapshotGVR).Namespace(c.namespace).Create(ctx, snapshot, metav1.CreateOptions{})
}

// DeleteSnapshot deletes a WukongSnapshot resource
func (c *Client) DeleteSnapshot(ctx context.Context, name string) error {
	return c.dynamicClient.Resource(WukongSnapshotGVR).Namespace(c.namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// WatchSnapshots watches for WukongSnapshot resource changes
func (c *Client) WatchSnapshots(ctx context.Context) (watch.Interface, error) {
	return c.dynamicClient.Resource(WukongSnapshotGVR).Namespace(c.namespace).Watch(ctx, metav1.ListOptions{})
}

// GetVMMetrics gets CPU and memory usage metrics for a VM
// vmName is the name from Wukong status.vmName (e.g., "ubuntu-vm-dual-network-dhcp-vm")
// wukongObj is the Wukong CRD object to extract volume information
func (c *Client) GetVMMetrics(ctx context.Context, vmName string, allocatedCPU int64, allocatedMemory string, wukongObj *unstructured.Unstructured) (*MetricsInfo, error) {
	if c.metricsClient == nil {
		// Metrics client not available, return nil
		return nil, nil
	}

	// Find the virt-launcher pod for this VM
	// Pod name format: virt-launcher-{vmName}-{hash}
	// Try to find pod by label first (more reliable)
	pods, err := c.clientset.CoreV1().Pods(c.namespace).List(ctx, metav1.ListOptions{
		LabelSelector: "kubevirt.io=virt-launcher",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	var targetPodName string
	for _, pod := range pods.Items {
		// Check if pod name starts with "virt-launcher-" and contains vmName
		// Pod name format: virt-launcher-{vmName}-{hash}
		if strings.HasPrefix(pod.Name, "virt-launcher-") && strings.Contains(pod.Name, vmName) {
			// Verify it's the correct pod by checking the vmName part
			// virt-launcher-{vmName}-{hash} should match exactly
			expectedPrefix := fmt.Sprintf("virt-launcher-%s-", vmName)
			if strings.HasPrefix(pod.Name, expectedPrefix) {
				targetPodName = pod.Name
				break
			}
		}
	}

	if targetPodName == "" {
		// Pod not found, return nil (metrics not available)
		return nil, nil
	}

	// Get pod metrics
	podMetrics, err := c.metricsClient.MetricsV1beta1().PodMetricses(c.namespace).Get(ctx, targetPodName, metav1.GetOptions{})
	if err != nil {
		// Metrics not available for this pod, return nil
		return nil, nil
	}

	// Calculate total CPU and memory usage from all containers
	var totalCPUUsage int64 // in millicores
	var totalMemoryUsage int64 // in bytes

	for _, container := range podMetrics.Containers {
		// CPU usage (convert from resource.Quantity to millicores)
		cpuQuantity := container.Usage.Cpu()
		if !cpuQuantity.IsZero() {
			totalCPUUsage += cpuQuantity.MilliValue()
		}

		// Memory usage (convert from resource.Quantity to bytes)
		memoryQuantity := container.Usage.Memory()
		if !memoryQuantity.IsZero() {
			totalMemoryUsage += memoryQuantity.Value()
		}
	}

	// Calculate usage percentages
	var cpuUsagePercent int
	var memoryUsagePercent int

	// CPU usage: (used millicores / allocated cores * 1000) * 100
	if allocatedCPU > 0 {
		cpuUsagePercent = int((float64(totalCPUUsage) / float64(allocatedCPU*1000)) * 100)
		if cpuUsagePercent > 100 {
			cpuUsagePercent = 100
		}
	}

	// Memory usage: (used bytes / allocated bytes) * 100
	allocatedMemoryBytes := parseMemoryToBytes(allocatedMemory)
	if allocatedMemoryBytes > 0 {
		memoryUsagePercent = int((float64(totalMemoryUsage) / float64(allocatedMemoryBytes)) * 100)
		if memoryUsagePercent > 100 {
			memoryUsagePercent = 100
		}
	}

	// Disk usage: Calculate from PVC usage
	diskUsagePercent := 0
	if wukongObj != nil {
		diskUsagePercent = c.getDiskUsageFromWukong(ctx, wukongObj)
	}

	return &MetricsInfo{
		CPUUsage:    cpuUsagePercent,
		MemoryUsage: memoryUsagePercent,
		DiskUsage:   diskUsagePercent,
	}, nil
}

// getDiskUsageFromWukong calculates disk usage percentage from Wukong volumes
// This method tries multiple approaches:
// 1. Kubelet stats API (most accurate, requires nodes/proxy permission)
// 2. PVC capacity (fallback, returns 0 if usage not available)
func (c *Client) getDiskUsageFromWukong(ctx context.Context, wukongObj *unstructured.Unstructured) int {
	status, _, _ := unstructured.NestedMap(wukongObj.Object, "status")
	if status == nil {
		return 0
	}

	// Get volumes from status
	volumes, ok, _ := unstructured.NestedSlice(status, "volumes")
	if !ok || len(volumes) == 0 {
		return 0
	}

	// Get the pod to find which node it's on
	vmName, ok, _ := unstructured.NestedString(status, "vmName")
	if !ok || vmName == "" {
		return 0
	}

	// Find the virt-launcher pod
	pods, err := c.clientset.CoreV1().Pods(c.namespace).List(ctx, metav1.ListOptions{
		LabelSelector: "kubevirt.io=virt-launcher",
	})
	if err != nil {
		return 0
	}

	var targetPod *corev1.Pod
	expectedPrefix := fmt.Sprintf("virt-launcher-%s-", vmName)
	for i := range pods.Items {
		pod := &pods.Items[i]
		if strings.HasPrefix(pod.Name, expectedPrefix) {
			targetPod = &pods.Items[i]
			break
		}
	}

	if targetPod == nil {
		return 0
	}

	// Try to get volume stats from kubelet stats API
	nodeName := targetPod.Spec.NodeName
	if nodeName == "" {
		return 0
	}

	diskUsage, err := c.getDiskUsageFromKubeletStats(ctx, nodeName, targetPod.Name, volumes)
	if err != nil {
		return 0
	}

	return diskUsage
}

// getDiskUsageFromKubeletStats gets disk usage from kubelet stats API
// This requires nodes/proxy permission in the service account
func (c *Client) getDiskUsageFromKubeletStats(ctx context.Context, nodeName, podName string, volumes []interface{}) (int, error) {
	// Access kubelet stats API via nodes/proxy
	// Path: /api/v1/nodes/{node}/proxy/stats/summary
	path := fmt.Sprintf("/api/v1/nodes/%s/proxy/stats/summary", nodeName)
	
	restClient := c.clientset.CoreV1().RESTClient()
	
	// Use DoRaw() to get raw JSON, then parse manually
	raw, err := restClient.Get().
		AbsPath(path).
		Do(ctx).
		Raw()

	if err != nil {
		return 0, fmt.Errorf("failed to get kubelet stats: %w", err)
	}

	var summary struct {
		Pods []struct {
			PodRef struct {
				Name      string `json:"name"`
				Namespace string `json:"namespace"`
			} `json:"podRef"`
			Volume []struct {
				Name          string `json:"name"`
				UsedBytes     *int64 `json:"usedBytes,omitempty"`
				CapacityBytes *int64 `json:"capacityBytes,omitempty"`
			} `json:"volume"`
		} `json:"pods"`
	}

	if err := json.Unmarshal(raw, &summary); err != nil {
		return 0, fmt.Errorf("failed to parse kubelet stats: %w", err)
	}

	// Find the pod in summary
	var podStats *struct {
		PodRef struct {
			Name      string `json:"name"`
			Namespace string `json:"namespace"`
		} `json:"podRef"`
		Volume []struct {
			Name          string `json:"name"`
			UsedBytes     *int64 `json:"usedBytes,omitempty"`
			CapacityBytes *int64 `json:"capacityBytes,omitempty"`
		} `json:"volume"`
	}

	for i := range summary.Pods {
		pod := &summary.Pods[i]
		if pod.PodRef.Name == podName && pod.PodRef.Namespace == c.namespace {
			podStats = pod
			break
		}
	}

	if podStats == nil {
		return 0, fmt.Errorf("pod %s/%s not found in kubelet stats", c.namespace, podName)
	}

	// Match volumes from Wukong status with kubelet volume stats
	var totalUsedBytes int64
	var totalCapacityBytes int64

	for _, volume := range volumes {
		volMap, ok := volume.(map[string]interface{})
		if !ok {
			continue
		}

		capacityStr := getStringField(volMap, "size")
		volumeName := getStringField(volMap, "name")

		// Find matching volume in kubelet stats
		// IMPORTANT: kubelet stats uses the Pod volume name (e.g., "system", "data"), NOT the PVC name
		// So we match by volume name, not PVC name
		for _, volStat := range podStats.Volume {
			// Match by volume name (e.g., "system", "data")
			if volumeName != "" && volStat.Name == volumeName {
				if volStat.UsedBytes != nil {
					totalUsedBytes += *volStat.UsedBytes
				}
				
				if volStat.CapacityBytes != nil {
					totalCapacityBytes += *volStat.CapacityBytes
				} else {
					// Fallback to Wukong status capacity
					totalCapacityBytes += parseMemoryToBytes(capacityStr)
				}
				break
			}
		}
	}

	if totalCapacityBytes == 0 {
		return 0, fmt.Errorf("no capacity found")
	}

	diskUsagePercent := int((float64(totalUsedBytes) / float64(totalCapacityBytes)) * 100)
	if diskUsagePercent > 100 {
		diskUsagePercent = 100
	}
	
	return diskUsagePercent, nil
}

// getDiskUsageFromPodVolumes is an alternative method to get disk usage
// It queries PVCs directly to get their capacity, but cannot get actual usage
// This is a fallback when kubelet stats are not available
// Currently not used, kept for future implementation
func (c *Client) getDiskUsageFromPodVolumes(ctx context.Context, pod *corev1.Pod, volumes []interface{}) int {
	// For now, we can only get capacity from PVC, not actual usage
	// So we return 0 to indicate usage is not available
	// In production, you might want to:
	// 1. Query storage provider API (e.g., Longhorn API)
	// 2. Query Prometheus metrics
	// 3. Use exec into the pod to run `df` command (not recommended for production)
	return 0
}

// parseMemoryToBytes converts memory string (e.g., "4Gi") to bytes
func parseMemoryToBytes(memory string) int64 {
	memory = strings.TrimSpace(memory)
	if len(memory) == 0 {
		return 0
	}

	// Remove suffix and parse number
	var multiplier int64 = 1
	if strings.HasSuffix(memory, "Gi") {
		multiplier = 1024 * 1024 * 1024 // 1 GiB = 1024^3 bytes
		memory = strings.TrimSuffix(memory, "Gi")
	} else if strings.HasSuffix(memory, "Mi") {
		multiplier = 1024 * 1024 // 1 MiB = 1024^2 bytes
		memory = strings.TrimSuffix(memory, "Mi")
	} else if strings.HasSuffix(memory, "Ki") {
		multiplier = 1024 // 1 KiB = 1024 bytes
		memory = strings.TrimSuffix(memory, "Ki")
	} else if strings.HasSuffix(memory, "G") {
		multiplier = 1000 * 1000 * 1000 // 1 GB = 1000^3 bytes
		memory = strings.TrimSuffix(memory, "G")
	} else if strings.HasSuffix(memory, "M") {
		multiplier = 1000 * 1000 // 1 MB = 1000^2 bytes
		memory = strings.TrimSuffix(memory, "M")
	} else if strings.HasSuffix(memory, "K") {
		multiplier = 1000 // 1 KB = 1000 bytes
		memory = strings.TrimSuffix(memory, "K")
	}

	value, err := strconv.ParseInt(memory, 10, 64)
	if err != nil {
		return 0
	}

	return value * multiplier
}

