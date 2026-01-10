# Wukong Dashboard

一個基於 Kubernetes 的虛擬機管理平台，集成 KubeVirt 虛擬機創建、Multus 多網卡管理、VNC 控制台、實時狀態監控和資源配額管理。

## 📋 目錄

- [功能特性](#功能特性)
- [系統架構](#系統架構)
- [快速開始](#快速開始)
- [開發指南](#開發指南)
- [構建和部署](#構建和部署)
- [API 文檔](#api-文檔)
- [故障排查](#故障排查)

## ✨ 功能特性

### 虛擬機管理
- 🖥️ **虛擬機生命週期管理** - 創建、啟動、停止、重啟、刪除 VM
- 📊 **實時狀態監控** - WebSocket 實時同步 VM 狀態、資源使用情況
- 🖱️ **VNC 控制台** - 瀏覽器內嵌 VNC 查看器，直接操作虛擬機
- 📈 **性能監控** - CPU、內存、磁盤使用率實時圖表展示

### 網絡管理
- 🌐 **多網卡支持** - 通過 Multus CNI 配置多個網絡接口
- 🔧 **靜態 IP 配置** - 支持 Cloud-Init 靜態 IP 分配
- 📡 **DHCP 支持** - 自動 IP 分配和動態網絡配置
- 🛡️ **NMState 安全檢查** - 防止節點網絡配置錯誤

### 存儲和快照
- 💾 **多磁盤支持** - 配置根磁盤和數據磁盤
- 📸 **快照管理** - 創建、查看、恢復虛擬機快照
- 🔄 **備份恢復** - 通過 WukongSnapshot CRD 實現備份和恢復

### GPU 支持
- 🎮 **GPU 直通** - 為虛擬機分配 GPU 設備
- 📊 **GPU 監控** - 實時 GPU 使用率監控

### 多租戶和配額管理
- 👥 **項目管理** - 多項目支持，項目隔離
- 👤 **用戶認證** - OAuth 集成，基於角色的訪問控制
- 📊 **資源配額** - 按項目設置 CPU、內存、存儲、GPU 配額
- ⚠️ **配額告警** - 資源使用超限提示

## 🏗️ 系統架構

### 前端 (React + TailwindCSS)
```
client/
├── src/
│   ├── pages/          # 頁面組件
│   ├── components/     # 可復用組件
│   ├── contexts/       # React Context（認證、項目）
│   ├── hooks/          # 自定義 Hooks
│   └── lib/            # 工具函數和 tRPC 客戶端
```

### 後端 (Node.js + tRPC)
```
server/
├── routers.ts          # tRPC 路由定義
├── db.ts               # 數據庫查詢助手
├── _core/              # 核心基礎設施
│   ├── context.ts      # tRPC 上下文
│   ├── trpc.ts         # tRPC 配置
│   └── auth.ts         # 認證邏輯
```

### Go 後端服務（可選）
```
go-backend/
├── cmd/server/         # 服務器入口
├── pkg/
│   ├── k8s/            # Kubernetes 客戶端
│   ├── handlers/       # API 處理器
│   ├── websocket/      # WebSocket 支持
│   └── vnc/            # VNC 代理
```

### 數據庫 (MySQL/TiDB)
- 用戶和認證表
- 項目和成員關係表
- 資源配額表
- 虛擬機和快照元數據表

## 🚀 快速開始

### 前置要求
- Node.js 22.13.0+
- pnpm 9.0+
- MySQL 8.0+ 或 TiDB
- Kubernetes 1.24+（用於實際部署）

### 本地開發

#### 1. 克隆倉庫
```bash
git clone https://github.com/kuihuar/wukong-dashboard.git
cd wukong-dashboard
```

#### 2. 安裝依賴
```bash
pnpm install
```

#### 3. 配置環境變量
```bash
# 複製環境模板（如果存在）
cp .env.example .env.local

# 編輯 .env.local 配置數據庫和認證信息
# 必要的環境變量：
# - DATABASE_URL: MySQL 連接字符串
# - JWT_SECRET: JWT 簽名密鑰
# - VITE_APP_ID: OAuth 應用 ID
# - OAUTH_SERVER_URL: OAuth 服務器 URL
```

#### 4. 初始化數據庫
```bash
# 生成和執行遷移
pnpm db:push
```

#### 5. 啟動開發服務器
```bash
pnpm dev
```

開發服務器將在 `http://localhost:3000` 啟動。

### 訪問應用
- 前端：http://localhost:3000
- 默認登錄通過 OAuth 進行

## 👨‍💻 開發指南

### 項目結構

#### 前端開發
```bash
# 開發前端代碼
pnpm dev

# 構建前端
pnpm build

# 預覽構建結果
pnpm preview
```

#### 後端開發
```bash
# 開發後端 API（tRPC）
# 編輯 server/routers.ts 添加新的路由

# 運行測試
pnpm test

# 生成類型
pnpm type-check
```

#### 數據庫開發
```bash
# 編輯 drizzle/schema.ts 定義表結構

# 生成遷移
pnpm db:generate

# 執行遷移
pnpm db:push

# 查看數據庫 UI
pnpm db:studio
```

### 代碼規範

#### 提交前檢查
```bash
# 運行所有測試
pnpm test

# 檢查代碼類型
pnpm type-check

# 格式化代碼
pnpm format
```

#### 分支管理
- `main` - 生產分支，所有代碼必須通過測試
- `develop` - 開發分支
- `feature/*` - 功能分支

### 添加新功能

#### 1. 定義數據模型
編輯 `drizzle/schema.ts`：
```typescript
export const newTable = mysqlTable('new_table', {
  id: int().primaryKey().autoincrement(),
  name: varchar({ length: 255 }).notNull(),
  // ... 其他字段
});
```

#### 2. 生成和執行遷移
```bash
pnpm db:generate
pnpm db:push
```

#### 3. 添加數據庫助手
編輯 `server/db.ts`：
```typescript
export async function getNewItems() {
  return db.select().from(newTable);
}
```

#### 4. 創建 tRPC 路由
編輯 `server/routers.ts`：
```typescript
newFeature: router({
  list: publicProcedure.query(async () => {
    return db.getNewItems();
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      // 實現創建邏輯
    }),
}),
```

#### 5. 創建前端頁面
創建 `client/src/pages/NewFeature.tsx`：
```typescript
import { trpc } from '@/lib/trpc';

export default function NewFeature() {
  const { data, isLoading } = trpc.newFeature.list.useQuery();
  
  return (
    <div>
      {/* 實現 UI */}
    </div>
  );
}
```

#### 6. 添加路由
編輯 `client/src/App.tsx`：
```typescript
<Route path="/new-feature" component={NewFeature} />
```

#### 7. 編寫測試
創建 `server/newfeature.test.ts`：
```typescript
import { describe, it, expect } from 'vitest';

describe('newFeature', () => {
  it('should work', async () => {
    // 測試實現
  });
});
```

## 📦 構建和部署

### Docker 構建

#### 構建前端鏡像
```bash
# 使用項目根目錄的 Dockerfile
docker build -t wukong-dashboard:latest .
```

#### 構建 Go 後端鏡像
```bash
cd go-backend
docker build -t wukong-dashboard-backend:latest .
```

### 本地 Docker 運行
```bash
# 啟動 MySQL
docker run -d \
  --name mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=wukong \
  -p 3306:3306 \
  mysql:8.0

# 運行應用
docker run -d \
  --name wukong-dashboard \
  -e DATABASE_URL="mysql://root:password@mysql:3306/wukong" \
  -e JWT_SECRET="your-secret-key" \
  -p 3000:3000 \
  wukong-dashboard:latest
```

### Kubernetes 部署

#### 前置條件
- Kubernetes 集群已安裝 KubeVirt
- Multus CNI 已配置
- MySQL 或 TiDB 數據庫可用

#### 部署步驟

1. **創建命名空間**
```bash
kubectl create namespace wukong
```

2. **創建配置和密鑰**
```bash
kubectl create secret generic wukong-secrets \
  --from-literal=database-url="mysql://user:pass@mysql:3306/wukong" \
  --from-literal=jwt-secret="your-secret-key" \
  -n wukong

kubectl create configmap wukong-config \
  --from-literal=oauth-server-url="https://oauth.example.com" \
  -n wukong
```

3. **部署應用**
```bash
kubectl apply -f k8s/deployment.yaml -n wukong
```

4. **暴露服務**
```bash
kubectl expose deployment wukong-dashboard \
  --type=LoadBalancer \
  --port=80 \
  --target-port=3000 \
  -n wukong
```

#### Kubernetes 部署文件示例
參考 `go-backend/deploy/kubernetes.yaml` 了解完整的部署配置。

### 生產部署檢查清單
- [ ] 環境變量已正確配置
- [ ] 數據庫已初始化和備份
- [ ] SSL/TLS 證書已配置
- [ ] 日誌收集已設置
- [ ] 監控和告警已配置
- [ ] 備份策略已制定
- [ ] 所有測試已通過

## 📚 API 文檔

### 認證 API
```typescript
// 獲取當前用戶信息
GET /api/trpc/auth.me

// 登出
POST /api/trpc/auth.logout
```

### 虛擬機 API
```typescript
// 列出虛擬機
GET /api/trpc/vm.list?projectId=1

// 獲取虛擬機詳情
GET /api/trpc/vm.get?id=vm-id

// 創建虛擬機
POST /api/trpc/vm.create
Body: { name, cpu, memory, disks, networks, gpus, projectId }

// 刪除虛擬機
POST /api/trpc/vm.delete?id=vm-id

// 執行虛擬機操作（啟動、停止等）
POST /api/trpc/vm.action
Body: { id, action: 'start' | 'stop' | 'restart' }
```

### 快照 API
```typescript
// 列出快照
GET /api/trpc/snapshot.list?vmId=vm-id

// 創建快照
POST /api/trpc/snapshot.create
Body: { vmId, name, description }

// 恢復快照
POST /api/trpc/snapshot.restore
Body: { snapshotId }

// 刪除快照
POST /api/trpc/snapshot.delete?id=snapshot-id
```

### 配額 API
```typescript
// 獲取項目配額
GET /api/trpc/quota.get?projectId=1

// 更新配額
POST /api/trpc/quota.update
Body: { projectId, maxVMs, maxCPU, maxMemoryGB, maxStorageGB, maxGPUs }

// 檢查配額
GET /api/trpc/quota.check?projectId=1&cpu=4&memory=8
```

### 項目 API
```typescript
// 獲取用戶項目
GET /api/trpc/project.myProjects

// 獲取默認項目
GET /api/trpc/project.getDefault

// 創建項目
POST /api/trpc/project.create
Body: { name, description, namespace }

// 獲取項目成員
GET /api/trpc/project.getMembers?projectId=1

// 添加項目成員
POST /api/trpc/project.addMember
Body: { projectId, userId, role }

// 移除項目成員
POST /api/trpc/project.removeMember
Body: { projectId, userId }
```

## 🔍 故障排查

### 常見問題

#### 1. 數據庫連接失敗
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**解決方案：**
- 檢查 MySQL 服務是否運行
- 驗證 DATABASE_URL 環境變量
- 確保數據庫用戶名和密碼正確

#### 2. OAuth 登錄失敗
```
Error: Invalid OAuth credentials
```

**解決方案：**
- 檢查 VITE_APP_ID 和 OAUTH_SERVER_URL
- 驗證 OAuth 應用配置
- 檢查回調 URL 是否正確配置

#### 3. WebSocket 連接失敗
```
WebSocket connection failed
```

**解決方案：**
- 檢查防火牆設置
- 驗證代理配置（如使用 nginx）
- 確保 WebSocket 協議支持

#### 4. Kubernetes API 連接失敗
```
Error: Unable to connect to Kubernetes API
```

**解決方案：**
- 檢查 kubeconfig 配置
- 驗證 API 服務器地址
- 確保認證令牌有效

### 調試技巧

#### 啟用詳細日誌
```bash
# 設置日誌級別
export LOG_LEVEL=debug
pnpm dev
```

#### 檢查數據庫狀態
```bash
pnpm db:studio
```

#### 查看 WebSocket 連接
在瀏覽器開發者工具中：
1. 打開 Network 標籤
2. 過濾 WS 連接
3. 檢查連接狀態和消息

#### 查看 Kubernetes 資源
```bash
# 查看虛擬機
kubectl get vms -n wukong

# 查看虛擬機詳情
kubectl describe vm vm-name -n wukong

# 查看虛擬機日誌
kubectl logs vm-name -n wukong
```

## 📝 許可證

MIT License - 詳見 LICENSE 文件

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

### 貢獻流程
1. Fork 本倉庫
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📞 支持

如有問題，請：
1. 查看 [故障排查](#故障排查) 部分
2. 提交 GitHub Issue
3. 聯繫開發團隊

## 🔗 相關倉庫

- [vmoperator](https://github.com/kuihuar/vmoperator) - Kubernetes 操作符
- [wukong-dashboard-backend](https://github.com/kuihuar/wukong-dashboard-backend) - Go 後端服務

---

**最後更新：** 2026-01-10  
**版本：** 1.0.0
