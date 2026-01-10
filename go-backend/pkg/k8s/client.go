package k8s

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// Client wraps Kubernetes client for Wukong and KubeVirt resources
type Client struct {
	clientset     *kubernetes.Clientset
	dynamicClient dynamic.Interface
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

	return &Client{
		clientset:     clientset,
		dynamicClient: dynamicClient,
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
