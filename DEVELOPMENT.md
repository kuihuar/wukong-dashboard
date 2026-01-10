# 開發環境配置指南

本文檔詳細說明如何設置和配置 Wukong Dashboard 的開發環境。

## 📋 目錄

- [系統要求](#系統要求)
- [環境變量配置](#環境變量配置)
- [數據庫設置](#數據庫設置)
- [開發工作流](#開發工作流)
- [測試](#測試)
- [調試](#調試)

## 🖥️ 系統要求

### 必需
- **Node.js**: 22.13.0 或更高版本
- **pnpm**: 9.0 或更高版本
- **MySQL**: 8.0 或更高版本（或 TiDB）
- **Git**: 2.30 或更高版本

### 可選
- **Docker**: 用於容器化開發
- **Kubernetes**: 用於測試 Kubernetes 集成
- **KubeVirt**: 用於測試虛擬機功能

### 系統要求
- 最少 4GB RAM（推薦 8GB+）
- 最少 10GB 磁盤空間
- 支持的操作系統：Linux、macOS、Windows（WSL2）

## 🔧 環境變量配置

### 1. 創建環境文件
```bash
cd /home/ubuntu/wukong-dashboard
cp .env.example .env.local  # 如果存在模板
# 或手動創建
touch .env.local
```

### 2. 配置必需的環境變量

#### 數據庫配置
```env
# MySQL 連接字符串
# 格式: mysql://用戶名:密碼@主機:端口/數據庫名
DATABASE_URL="mysql://root:password@localhost:3306/wukong"

# 或使用 TiDB
# DATABASE_URL="mysql://root:password@tidb-host:4000/wukong"
```

#### 認證配置
```env
# JWT 簽名密鑰（用於會話管理）
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# OAuth 應用配置
VITE_APP_ID="your-oauth-app-id"
OAUTH_SERVER_URL="https://oauth.example.com"
VITE_OAUTH_PORTAL_URL="https://oauth.example.com/portal"
```

#### 應用配置
```env
# 應用標題和 Logo
VITE_APP_TITLE="Wukong Dashboard"
VITE_APP_LOGO="/logo.png"

# 所有者信息
OWNER_NAME="Admin"
OWNER_OPEN_ID="admin-id"
```

#### 可選的 Kubernetes 配置
```env
# Kubernetes API 配置（用於 Go 後端）
KUBERNETES_API_URL="https://kubernetes-api:6443"
KUBERNETES_NAMESPACE="wukong"
KUBECONFIG="/path/to/kubeconfig"
```

### 3. 環境變量示例
```bash
# .env.local 完整示例
DATABASE_URL="mysql://root:root@localhost:3306/wukong_dev"
JWT_SECRET="dev-secret-key-12345"
VITE_APP_ID="dev-app-id"
OAUTH_SERVER_URL="http://localhost:8080"
VITE_OAUTH_PORTAL_URL="http://localhost:8080/portal"
VITE_APP_TITLE="Wukong Dashboard Dev"
OWNER_NAME="Developer"
OWNER_OPEN_ID="dev-user-1"
```

## 🗄️ 數據庫設置

### 1. 本地 MySQL 安裝

#### Linux (Ubuntu/Debian)
```bash
# 安裝 MySQL
sudo apt-get update
sudo apt-get install mysql-server

# 啟動服務
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全配置
sudo mysql_secure_installation
```

#### macOS (使用 Homebrew)
```bash
# 安裝 MySQL
brew install mysql

# 啟動服務
brew services start mysql

# 初始化
mysql_secure_installation
```

#### Docker 方式（推薦）
```bash
# 運行 MySQL 容器
docker run -d \
  --name wukong-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=wukong_dev \
  -p 3306:3306 \
  -v mysql-data:/var/lib/mysql \
  mysql:8.0

# 驗證連接
mysql -h localhost -u root -p
```

### 2. 創建數據庫和用戶

```bash
# 連接到 MySQL
mysql -u root -p

# 執行以下 SQL 命令
CREATE DATABASE wukong_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wukong'@'localhost' IDENTIFIED BY 'wukong_password';
GRANT ALL PRIVILEGES ON wukong_dev.* TO 'wukong'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. 初始化數據庫架構

```bash
# 生成遷移文件
pnpm db:generate

# 執行遷移
pnpm db:push

# 驗證（可選）
pnpm db:studio
```

## 🔄 開發工作流

### 1. 啟動開發服務器

```bash
# 安裝依賴
pnpm install

# 啟動開發服務器
pnpm dev
```

服務器將在 `http://localhost:3000` 啟動，支持：
- 熱模塊替換 (HMR)
- 自動重新加載
- 源映射用於調試

### 2. 開發前端

#### 編輯頁面
```bash
# 編輯 client/src/pages/YourPage.tsx
# 更改會自動反映在瀏覽器中
```

#### 使用 shadcn/ui 組件
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Click me</Button>
      </CardContent>
    </Card>
  );
}
```

#### 調用後端 API
```typescript
import { trpc } from '@/lib/trpc';

export default function MyComponent() {
  const { data, isLoading, error } = trpc.vm.list.useQuery();
  
  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && <p>VMs: {data.length}</p>}
    </div>
  );
}
```

### 3. 開發後端

#### 添加新的 tRPC 路由
```typescript
// server/routers.ts
export const appRouter = router({
  newFeature: router({
    list: publicProcedure.query(async () => {
      return db.getNewItems();
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // ctx.user 包含當前用戶信息
        return db.createNewItem(input);
      }),
  }),
});
```

#### 訪問當前用戶
```typescript
protectedProcedure.query(async ({ ctx }) => {
  console.log(ctx.user.id);      // 用戶 ID
  console.log(ctx.user.email);   // 用戶郵箱
  console.log(ctx.user.name);    // 用戶名稱
  console.log(ctx.user.role);    // 用戶角色 (admin/user)
});
```

### 4. 開發數據庫

#### 修改數據庫架構
```typescript
// drizzle/schema.ts
export const newTable = mysqlTable('new_table', {
  id: int().primaryKey().autoincrement(),
  name: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().defaultNow(),
});
```

#### 生成和應用遷移
```bash
# 生成遷移文件
pnpm db:generate

# 查看遷移預覽
cat drizzle/*.sql

# 應用遷移
pnpm db:push
```

#### 使用數據庫 UI
```bash
# 打開 Drizzle Studio
pnpm db:studio
```

## 🧪 測試

### 運行測試
```bash
# 運行所有測試
pnpm test

# 運行特定文件的測試
pnpm test server/vm.test.ts

# 監視模式（文件變化時自動重新運行）
pnpm test --watch

# 生成覆蓋率報告
pnpm test --coverage
```

### 編寫測試

#### 測試示例
```typescript
// server/newfeature.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';

describe('newFeature', () => {
  beforeAll(async () => {
    // 測試前的設置
  });

  afterAll(async () => {
    // 測試後的清理
  });

  it('should create a new item', async () => {
    const item = await db.createNewItem({
      name: 'Test Item',
      description: 'Test Description',
    });

    expect(item).toBeDefined();
    expect(item.name).toBe('Test Item');
  });

  it('should list items', async () => {
    const items = await db.getNewItems();
    expect(Array.isArray(items)).toBe(true);
  });
});
```

### 測試最佳實踐
- 每個功能應有對應的測試
- 使用描述性的測試名稱
- 測試應該是獨立的，不依賴執行順序
- 使用 `beforeAll` 和 `afterAll` 進行設置和清理
- 模擬外部依賴（數據庫、API 等）

## 🐛 調試

### 瀏覽器調試

#### 打開開發者工具
```
Windows/Linux: F12 或 Ctrl+Shift+I
macOS: Cmd+Option+I
```

#### 檢查 tRPC 調用
1. 打開 Network 標籤
2. 過濾 `/api/trpc`
3. 查看請求和響應

#### 查看 React 組件
1. 安裝 React Developer Tools 瀏覽器擴展
2. 檢查組件狀態和屬性

### 服務器調試

#### 查看服務器日誌
```bash
# 開發服務器已在控制台輸出日誌
pnpm dev

# 查看特定的日誌級別
LOG_LEVEL=debug pnpm dev
```

#### 添加調試語句
```typescript
// 在 tRPC 路由中
console.log('Debug info:', data);
console.error('Error occurred:', error);
```

#### 使用 Node.js 調試器
```bash
# 啟用調試模式
node --inspect-brk ./node_modules/.bin/tsx server/_core/index.ts

# 在 Chrome 中訪問 chrome://inspect
```

### 數據庫調試

#### 查看 SQL 查詢
```bash
# 啟用 SQL 日誌
pnpm db:studio
```

#### 直接查詢數據庫
```bash
# 連接到 MySQL
mysql -u root -p wukong_dev

# 查看表
SHOW TABLES;

# 查看表結構
DESCRIBE users;

# 查詢數據
SELECT * FROM users;
```

### WebSocket 調試

#### 檢查 WebSocket 連接
```javascript
// 在瀏覽器控制台中
// 查看 Network 標籤中的 WS 連接
// 檢查 Messages 標籤查看實時消息
```

## 📊 性能優化

### 前端優化
- 使用 React DevTools Profiler 分析組件性能
- 檢查不必要的重新渲染
- 使用 `useMemo` 和 `useCallback` 優化

### 後端優化
- 使用數據庫索引
- 實現查詢結果緩存
- 使用連接池

### 構建優化
```bash
# 分析構建大小
pnpm build --analyze

# 檢查依賴大小
pnpm install --dry-run
```

## 🚀 準備生產

### 前置檢查清單
- [ ] 所有測試通過
- [ ] 代碼經過 linting
- [ ] 環境變量已配置
- [ ] 數據庫已備份
- [ ] SSL/TLS 證書已準備
- [ ] 日誌記錄已配置
- [ ] 監控已設置

### 構建生產版本
```bash
# 構建前端和後端
pnpm build

# 驗證構建
pnpm preview
```

### 部署
```bash
# 使用 Docker
docker build -t wukong-dashboard:latest .
docker run -d -p 80:3000 wukong-dashboard:latest

# 使用 Kubernetes
kubectl apply -f k8s/deployment.yaml
```

## 📚 其他資源

- [tRPC 文檔](https://trpc.io/)
- [Drizzle ORM 文檔](https://orm.drizzle.team/)
- [React 文檔](https://react.dev/)
- [TailwindCSS 文檔](https://tailwindcss.com/)
- [Kubernetes 文檔](https://kubernetes.io/docs/)

## 🤝 獲取幫助

如遇到問題：
1. 檢查 [README.md](./README.md) 中的故障排查部分
2. 查看相關的 GitHub Issues
3. 提交新的 Issue 或 Discussion

---

**最後更新：** 2026-01-10
