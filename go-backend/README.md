# Wukong Dashboard Go Backend

A Go-based backend service for the Wukong Dashboard that provides real Kubernetes API integration, WebSocket-based real-time updates, and VNC console proxy for KubeVirt virtual machines.

## Features

- **Kubernetes API Integration**: Uses `client-go` to interact with Wukong CRDs and KubeVirt resources
- **RESTful API**: Gin-based HTTP server providing VM and snapshot management endpoints
- **Real-time Updates**: WebSocket hub that watches Kubernetes resources and broadcasts changes
- **VNC Console Proxy**: WebSocket proxy for KubeVirt VNC connections

## Architecture

```
go-backend/
├── cmd/server/          # Application entry point
│   └── main.go
├── pkg/
│   ├── k8s/             # Kubernetes client and converters
│   │   ├── client.go    # K8s client wrapper
│   │   └── converter.go # Resource type converters
│   ├── handlers/        # HTTP handlers
│   │   ├── vm.go        # VM CRUD operations
│   │   ├── snapshot.go  # Snapshot operations
│   │   └── websocket.go # WebSocket handler
│   ├── websocket/       # WebSocket hub
│   │   └── hub.go       # Client management & broadcasting
│   └── vnc/             # VNC proxy
│       └── proxy.go     # KubeVirt VNC WebSocket proxy
├── deploy/              # Kubernetes manifests
│   └── kubernetes.yaml
├── Dockerfile
└── go.mod
```

## API Endpoints

### Virtual Machines

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vms` | List all VMs |
| GET | `/api/vms/stats` | Get VM statistics |
| POST | `/api/vms` | Create a new VM |
| GET | `/api/vms/:name` | Get VM details |
| POST | `/api/vms/:name/action` | Perform VM action (start/stop/restart/delete) |
| GET | `/api/vms/:name/snapshots` | List VM snapshots |
| GET | `/api/vms/:name/vnc` | WebSocket VNC proxy |
| GET | `/api/vms/:name/vnc/info` | Get VNC availability info |

### Snapshots

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/snapshots` | List all snapshots |
| POST | `/api/snapshots` | Create a new snapshot |
| POST | `/api/snapshots/:name/restore` | Restore from snapshot |
| DELETE | `/api/snapshots/:name` | Delete a snapshot |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/api/ws` | Real-time updates WebSocket |

## WebSocket Message Format

```json
{
  "type": "update",
  "resource": "vm",
  "action": "MODIFIED",
  "data": { ... },
  "timestamp": 1704067200000
}
```

Actions: `ADDED`, `MODIFIED`, `DELETED`

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NAMESPACE` | `default` | Kubernetes namespace to watch |
| `PORT` | `8080` | HTTP server port |
| `GIN_MODE` | `release` | Gin framework mode |
| `KUBECONFIG` | `~/.kube/config` | Path to kubeconfig (if not in-cluster) |

## Building

```bash
# Local build
go build -o wukong-backend ./cmd/server

# Docker build
docker build -t kuihuar/wukong-dashboard-backend:latest .
```

## Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f deploy/kubernetes.yaml

# Check deployment status
kubectl get pods -l app=wukong-dashboard-backend
```

## Development

```bash
# Run locally (requires kubeconfig)
export NAMESPACE=default
export GIN_MODE=debug
go run ./cmd/server

# Run tests
go test ./...
```

## RBAC Requirements

The service account requires the following permissions:

- `vm.novasphere.dev`: Full access to Wukong and WukongSnapshot CRDs
- `kubevirt.io`: Read/write access to VirtualMachines and VirtualMachineInstances
- `subresources.kubevirt.io`: Access to VMI VNC subresource

See `deploy/kubernetes.yaml` for the complete RBAC configuration.

## Integration with Frontend

The Go backend is designed to work alongside the Node.js/tRPC frontend. In production:

1. Deploy both services in the same namespace
2. Configure Ingress to route `/api/*` to the Go backend
3. The frontend will automatically connect to WebSocket and VNC endpoints

## License

MIT
