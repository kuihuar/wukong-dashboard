# API 文檔

Wukong Dashboard 使用 tRPC 作為 API 框架，提供端到端的類型安全 API。

## 📋 目錄

- [概述](#概述)
- [認證](#認證)
- [虛擬機 API](#虛擬機-api)
- [快照 API](#快照-api)
- [配額 API](#配額-api)
- [項目 API](#項目-api)
- [錯誤處理](#錯誤-處理)
- [示例](#示例)

## 概述

### 基本信息
- **基礎 URL**: `/api/trpc`
- **認證**: Cookie 基礎（OAuth）
- **格式**: JSON
- **類型安全**: TypeScript 端到端類型檢查

### 請求格式
```
GET /api/trpc/{router}.{procedure}?input={encodedInput}
POST /api/trpc/{router}.{procedure}
```

### 響應格式
```json
{
  "result": {
    "data": {},
    "type": "data"
  }
}
```

## 認證

### 登錄流程
1. 用戶訪問應用
2. 重定向到 OAuth 提供商
3. 用戶授權
4. 重定向回應用，設置 session cookie
5. 後續請求自動包含認證信息

### 獲取當前用戶
```typescript
// 請求
GET /api/trpc/auth.me

// 響應
{
  "result": {
    "data": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "type": "data"
  }
}
```

### 登出
```typescript
// 請求
POST /api/trpc/auth.logout

// 響應
{
  "result": {
    "data": { "success": true },
    "type": "data"
  }
}
```

## 虛擬機 API

### 列出虛擬機
```typescript
// 請求
GET /api/trpc/vm.list?input={"projectId":1}

// 響應
{
  "result": {
    "data": [
      {
        "id": "vm-1",
        "name": "ubuntu-server",
        "status": "Running",
        "cpu": 4,
        "memory": "8Gi",
        "nodeName": "node-01",
        "createdAt": 1704844800000,
        "projectId": 1,
        "networks": [
          {
            "name": "default",
            "interface": "eth0",
            "ipAddress": "10.244.1.15",
            "macAddress": "52:54:00:12:34:56"
          }
        ],
        "disks": [
          {
            "name": "rootdisk",
            "size": "80Gi",
            "storageClassName": "longhorn",
            "boot": true,
            "image": "ubuntu:22.04"
          }
        ],
        "gpus": [],
        "osImage": "Ubuntu 22.04 LTS",
        "metrics": {
          "cpuUsage": 45,
          "memoryUsage": 62,
          "diskUsage": 35
        }
      }
    ],
    "type": "data"
  }
}
```

### 獲取虛擬機詳情
```typescript
// 請求
GET /api/trpc/vm.get?input={"id":"vm-1"}

// 響應
{
  "result": {
    "data": {
      "id": "vm-1",
      "name": "ubuntu-server",
      // ... 完整的 VM 信息
    },
    "type": "data"
  }
}
```

### 創建虛擬機
```typescript
// 請求
POST /api/trpc/vm.create
Content-Type: application/json

{
  "name": "new-vm",
  "cpu": 4,
  "memory": "8Gi",
  "projectId": 1,
  "disks": [
    {
      "name": "rootdisk",
      "size": "80Gi",
      "storageClassName": "longhorn",
      "boot": true,
      "image": "ubuntu:22.04"
    }
  ],
  "networks": [
    {
      "name": "default",
      "type": "bridge"
    }
  ],
  "gpus": []
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "id": "vm-1",
      "message": "Virtual machine created successfully"
    },
    "type": "data"
  }
}
```

### 刪除虛擬機
```typescript
// 請求
POST /api/trpc/vm.delete
Content-Type: application/json

{
  "id": "vm-1"
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "message": "Virtual machine deleted successfully"
    },
    "type": "data"
  }
}
```

### 執行虛擬機操作
```typescript
// 請求
POST /api/trpc/vm.action
Content-Type: application/json

{
  "id": "vm-1",
  "action": "start"  // "start" | "stop" | "restart"
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "message": "Virtual machine started successfully"
    },
    "type": "data"
  }
}
```

## 快照 API

### 列出快照
```typescript
// 請求
GET /api/trpc/snapshot.list?input={"vmId":"vm-1"}

// 響應
{
  "result": {
    "data": [
      {
        "id": "snap-1",
        "vmId": "vm-1",
        "name": "backup-2026-01-10",
        "description": "Daily backup",
        "createdAt": 1704844800000,
        "size": "5Gi"
      }
    ],
    "type": "data"
  }
}
```

### 創建快照
```typescript
// 請求
POST /api/trpc/snapshot.create
Content-Type: application/json

{
  "vmId": "vm-1",
  "name": "backup-2026-01-10",
  "description": "Daily backup"
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "id": "snap-1",
      "message": "Snapshot created successfully"
    },
    "type": "data"
  }
}
```

### 恢復快照
```typescript
// 請求
POST /api/trpc/snapshot.restore
Content-Type: application/json

{
  "snapshotId": "snap-1"
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "message": "Snapshot restored successfully"
    },
    "type": "data"
  }
}
```

### 刪除快照
```typescript
// 請求
POST /api/trpc/snapshot.delete
Content-Type: application/json

{
  "id": "snap-1"
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "message": "Snapshot deleted successfully"
    },
    "type": "data"
  }
}
```

## 配額 API

### 獲取項目配額
```typescript
// 請求
GET /api/trpc/quota.get?input={"projectId":1}

// 響應
{
  "result": {
    "data": {
      "id": 1,
      "projectId": 1,
      "maxVMs": 10,
      "maxCPU": 32,
      "maxMemoryGB": 64,
      "maxStorageGB": 500,
      "maxGPUs": 0,
      "maxSnapshots": 20,
      "enabled": true,
      "usedVMs": 3,
      "usedCPU": 12,
      "usedMemoryGB": 24,
      "usedStorageGB": 150,
      "usedGPUs": 0,
      "usedSnapshots": 5
    },
    "type": "data"
  }
}
```

### 更新配額
```typescript
// 請求
POST /api/trpc/quota.update
Content-Type: application/json

{
  "projectId": 1,
  "maxVMs": 20,
  "maxCPU": 64,
  "maxMemoryGB": 128,
  "maxStorageGB": 1000,
  "maxGPUs": 4,
  "maxSnapshots": 50
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "message": "Quota updated successfully"
    },
    "type": "data"
  }
}
```

### 檢查配額
```typescript
// 請求
GET /api/trpc/quota.check?input={"projectId":1,"cpu":4,"memory":8}

// 響應
{
  "result": {
    "data": {
      "canCreate": true,
      "remainingVMs": 7,
      "remainingCPU": 20,
      "remainingMemoryGB": 40,
      "remainingStorageGB": 350
    },
    "type": "data"
  }
}
```

## 項目 API

### 獲取用戶項目
```typescript
// 請求
GET /api/trpc/project.myProjects

// 響應
{
  "result": {
    "data": [
      {
        "id": 1,
        "name": "Default Project",
        "description": "Default project",
        "namespace": "wukong-user-1",
        "ownerId": 1,
        "isDefault": true,
        "createdAt": 1704844800000,
        "updatedAt": 1704844800000,
        "userRole": "owner"
      }
    ],
    "type": "data"
  }
}
```

### 獲取默認項目
```typescript
// 請求
GET /api/trpc/project.getDefault

// 響應
{
  "result": {
    "data": {
      "id": 1,
      "name": "Default Project",
      // ... 項目信息
    },
    "type": "data"
  }
}
```

### 創建項目
```typescript
// 請求
POST /api/trpc/project.create
Content-Type: application/json

{
  "name": "New Project",
  "description": "Project description",
  "namespace": "new-project-ns"
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "id": 2,
      "message": "Project created successfully"
    },
    "type": "data"
  }
}
```

### 獲取項目成員
```typescript
// 請求
GET /api/trpc/project.getMembers?input={"projectId":1}

// 響應
{
  "result": {
    "data": [
      {
        "userId": 1,
        "userName": "John Doe",
        "email": "john@example.com",
        "role": "owner",
        "joinedAt": 1704844800000
      }
    ],
    "type": "data"
  }
}
```

### 添加項目成員
```typescript
// 請求
POST /api/trpc/project.addMember
Content-Type: application/json

{
  "projectId": 1,
  "userId": 2,
  "role": "member"  // "owner" | "admin" | "member" | "viewer"
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "message": "Member added successfully"
    },
    "type": "data"
  }
}
```

### 移除項目成員
```typescript
// 請求
POST /api/trpc/project.removeMember
Content-Type: application/json

{
  "projectId": 1,
  "userId": 2
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "message": "Member removed successfully"
    },
    "type": "data"
  }
}
```

### 更新成員角色
```typescript
// 請求
POST /api/trpc/project.updateMemberRole
Content-Type: application/json

{
  "projectId": 1,
  "userId": 2,
  "role": "admin"
}

// 響應
{
  "result": {
    "data": {
      "success": true,
      "message": "Member role updated successfully"
    },
    "type": "data"
  }
}
```

## 錯誤 處理

### 錯誤響應格式
```json
{
  "error": {
    "message": "Error message",
    "code": "UNAUTHORIZED",
    "data": {
      "code": "UNAUTHORIZED"
    }
  }
}
```

### 常見錯誤碼

| 錯誤碼 | HTTP 狀態 | 說明 |
|--------|-----------|------|
| UNAUTHORIZED | 401 | 未認證或認證過期 |
| FORBIDDEN | 403 | 無權限訪問 |
| NOT_FOUND | 404 | 資源不存在 |
| BAD_REQUEST | 400 | 請求參數無效 |
| CONFLICT | 409 | 資源衝突（如重複創建） |
| INTERNAL_SERVER_ERROR | 500 | 服務器內部錯誤 |

### 錯誤示例

#### 未認證
```json
{
  "error": {
    "message": "Not authenticated",
    "code": "UNAUTHORIZED"
  }
}
```

#### 無權限
```json
{
  "error": {
    "message": "You don't have permission to access this project",
    "code": "FORBIDDEN"
  }
}
```

#### 資源不存在
```json
{
  "error": {
    "message": "Virtual machine not found",
    "code": "NOT_FOUND"
  }
}
```

#### 配額超限
```json
{
  "error": {
    "message": "Insufficient quota: CPU limit exceeded",
    "code": "BAD_REQUEST"
  }
}
```

## 示例

### JavaScript/TypeScript 客戶端

#### 使用 tRPC 客戶端
```typescript
import { trpc } from '@/lib/trpc';

// 列出虛擬機
const { data: vms } = await trpc.vm.list.useQuery({ projectId: 1 });

// 創建虛擬機
const { mutate: createVM } = trpc.vm.create.useMutation();
createVM({
  name: 'new-vm',
  cpu: 4,
  memory: '8Gi',
  projectId: 1,
  disks: [],
  networks: [],
  gpus: [],
});

// 獲取配額
const { data: quota } = await trpc.quota.get.useQuery({ projectId: 1 });
```

#### 使用 Fetch API
```typescript
// 列出虛擬機
const response = await fetch('/api/trpc/vm.list?input={"projectId":1}');
const { result } = await response.json();
console.log(result.data);

// 創建虛擬機
const response = await fetch('/api/trpc/vm.create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'new-vm',
    cpu: 4,
    memory: '8Gi',
    projectId: 1,
    disks: [],
    networks: [],
    gpus: [],
  }),
});
const { result } = await response.json();
console.log(result.data);
```

### cURL 示例

```bash
# 列出虛擬機
curl 'http://localhost:3000/api/trpc/vm.list?input={"projectId":1}'

# 創建虛擬機
curl -X POST 'http://localhost:3000/api/trpc/vm.create' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "new-vm",
    "cpu": 4,
    "memory": "8Gi",
    "projectId": 1,
    "disks": [],
    "networks": [],
    "gpus": []
  }'

# 獲取配額
curl 'http://localhost:3000/api/trpc/quota.get?input={"projectId":1}'
```

---

**最後更新：** 2026-01-10
