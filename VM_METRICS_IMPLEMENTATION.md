# VM Metrics 实现说明

## 概述

本实现通过 Kubernetes Metrics API（metrics-server）获取虚拟机的 CPU 和内存使用情况。

## 实现方式

### 1. **首页的 Allocated Memory（已实现）**

从所有 VM 的 `spec.memory` 累加得到总分配内存：

```go
// go-backend/pkg/handlers/vm.go - GetVMStats
totalMemoryGi += memGi
stats.TotalMemory = fmt.Sprintf("%dGi", totalMemoryGi)
```

**数据来源**：Wukong CRD 的 `spec.memory` 字段

### 2. **VM 的 CPU Usage 和 Memory Usage（新实现）**

通过 Kubernetes Metrics API 获取：

1. **查找 Pod**：从 Wukong CRD 的 `status.vmName` 获取 VM 名称
2. **匹配 virt-launcher Pod**：Pod 名称格式为 `virt-launcher-{vmName}-{hash}`
3. **获取 Metrics**：使用 `metrics.k8s.io/v1beta1` API 获取 Pod 的 CPU 和内存使用量
4. **计算使用率**：
   - CPU Usage = (使用的 millicores / 分配的 cores * 1000) * 100
   - Memory Usage = (使用的 bytes / 分配的 bytes) * 100

**代码位置**：
- `go-backend/pkg/k8s/client.go` - `GetVMMetrics()` 函数
- `go-backend/pkg/handlers/vm.go` - `ListVMs()` 和 `GetVM()` 函数

### 3. **Disk Usage（已实现）**

通过 **Kubelet Stats API** 获取磁盘使用情况：

1. **从 Wukong status.volumes 获取 PVC 信息**：包括 PVC 名称和容量
2. **查找 virt-launcher Pod**：确定 Pod 所在的节点
3. **调用 Kubelet Stats API**：通过 `/api/v1/nodes/{node}/proxy/stats/summary` 获取 Pod 的 volume stats
4. **匹配 PVC 和 Volume Stats**：通过 PVC 名称匹配 kubelet 返回的 volume stats
5. **计算使用率**：`(使用的 bytes / 总容量 bytes) * 100`

**代码位置**：
- `go-backend/pkg/k8s/client.go` - `getDiskUsageFromWukong()` 和 `getDiskUsageFromKubeletStats()` 函数

**权限要求**：
- Service Account 需要 `nodes/proxy` 权限（已在 `deploy/kubernetes.yaml` 中配置）

**备选方案**（如果 kubelet stats 不可用）：
1. **Prometheus**：查询 `kubelet_volume_stats_used_bytes` 和 `kubelet_volume_stats_capacity_bytes`
2. **存储提供商 API**：如 Longhorn API、Ceph API 等
3. **返回 0**：表示 metrics 不可用（当前实现）

## 依赖要求

1. **metrics-server**：集群必须安装并运行 metrics-server
   ```bash
   kubectl get svc -n kube-system metrics-server
   ```

2. **Go 依赖**：`k8s.io/metrics/pkg/client/clientset/versioned`
   - 已通过 `go mod tidy` 自动添加

## 使用方式

### API 端点

- `GET /api/vms` - 返回所有 VM 列表，包含 metrics（如果可用）
- `GET /api/vms/:name` - 返回单个 VM 详情，包含 metrics（如果可用）

### 响应格式

```json
{
  "id": "...",
  "name": "ubuntu-vm",
  "status": "Running",
  "cpu": 2,
  "memory": "4Gi",
  "metrics": {
    "cpuUsage": 45,      // CPU 使用率百分比 (0-100)
    "memoryUsage": 62,   // 内存使用率百分比 (0-100)
    "diskUsage": 0       // 磁盘使用率百分比 (0-100)，目前未实现
  }
}
```

## 注意事项

1. **Metrics 可用性**：
   - 只有 `status == "Running"` 的 VM 才会尝试获取 metrics
   - 如果 metrics-server 不可用或 Pod 不存在，`metrics` 字段为 `null`
   - 不会因为 metrics 获取失败而影响其他数据的返回
   - **Disk Usage**：如果 kubelet stats API 不可用（权限不足或 API 不可访问），返回 0

2. **性能考虑**：
   - 在 `ListVMs` 中，每个 VM 都会尝试获取 metrics，可能影响性能
   - 建议后续优化：批量获取 metrics 或使用缓存
   - **Disk Usage**：需要为每个 VM 调用 kubelet stats API，可能较慢

3. **Pod 匹配逻辑**：
   - 通过 `status.vmName` 查找对应的 `virt-launcher-{vmName}-{hash}` Pod
   - 如果找不到 Pod，metrics 为 `null`
   - **Disk Usage**：通过 PVC 名称匹配 kubelet volume stats（volume 名称格式：`kubernetes.io~pvc/pvc-name`）

4. **权限要求**：
   - CPU/Memory Usage：需要 `metrics.k8s.io` API 访问权限（metrics-server）
   - Disk Usage：需要 `nodes/proxy` 权限（已在 RBAC 中配置）

## 测试

1. **检查 metrics-server**：
   ```bash
   kubectl get svc -n kube-system metrics-server
   kubectl top pod -n default
   ```

2. **测试 API**：
   ```bash
   curl http://localhost:8081/api/vms
   curl http://localhost:8081/api/vms/ubuntu-vm-dual-network-dhcp
   ```

3. **验证 metrics**：
   - 确保 VM 处于 `Running` 状态
   - 检查响应中的 `metrics` 字段是否包含数据

