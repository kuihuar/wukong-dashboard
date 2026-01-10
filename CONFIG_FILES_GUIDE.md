# Wukong Dashboard - 配置文件完整指南

## 📋 配置文件清單

wukong-dashboard 項目包含以下配置文件：

| 配置文件 | 位置 | 用途 | 類型 |
|---------|------|------|------|
| `package.json` | 根目錄 | 項目依賴和腳本 | 必需 |
| `tsconfig.json` | 根目錄 | TypeScript 編譯配置 | 必需 |
| `vite.config.ts` | 根目錄 | Vite 前端構建配置 | 必需 |
| `vitest.config.ts` | 根目錄 | Vitest 測試配置 | 必需 |
| `drizzle.config.ts` | 根目錄 | Drizzle ORM 配置 | 必需 |
| `components.json` | 根目錄 | shadcn/ui 組件配置 | 可選 |
| `.env.example` | 根目錄 | 環境變量模板 | 參考 |
| `.env.local` | 根目錄 (本地) | 環境變量 (本地開發) | 本地 |
| `.env.production` | 根目錄 (生產) | 環境變量 (生產) | 生產 |

---

## 📂 詳細配置文件說明

### 1. **package.json** - 項目依賴和腳本

**位置：** `/package.json`

**用途：** 定義項目依賴、版本、腳本命令

**關鍵內容：**
```json
{
  "name": "wukong-dashboard",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
    "build": "vite build && esbuild server/_core/index.ts ...",
    "start": "NODE_ENV=production node dist/index.js",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit generate && drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "react": "^19.0.0",
    "express": "^4.21.2",
    "@trpc/server": "^11.6.0",
    ...
  }
}
```

**何時加載：** 項目初始化時

**何時修改：** 添加新依賴或修改腳本命令

---

### 2. **tsconfig.json** - TypeScript 編譯配置

**位置：** `/tsconfig.json`

**用途：** 配置 TypeScript 編譯器選項

**關鍵內容：**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["client/src/*"]
    },
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["client", "server", "drizzle", "shared"],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

**何時加載：** TypeScript 編譯時

**何時修改：** 調整編譯選項或路徑別名

---

### 3. **vite.config.ts** - Vite 前端構建配置

**位置：** `/vite.config.ts`

**用途：** 配置 Vite 前端開發服務器和構建

**關鍵內容：**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
})
```

**何時加載：** 運行 `pnpm dev` 時

**何時修改：** 調整開發服務器設置或構建選項

---

### 4. **vitest.config.ts** - Vitest 測試配置

**位置：** `/vitest.config.ts`

**用途：** 配置 Vitest 單元測試框架

**關鍵內容：**
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
})
```

**何時加載：** 運行 `pnpm test` 時

**何時修改：** 調整測試框架選項

---

### 5. **drizzle.config.ts** - Drizzle ORM 配置

**位置：** `/drizzle.config.ts`

**用途：** 配置 Drizzle ORM 和數據庫遷移

**關鍵內容：**
```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  driver: 'mysql2',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'wukong_dev',
  },
  verbose: true,
  strict: true,
} satisfies Config
```

**何時加載：** 運行 `pnpm db:push` 或 `pnpm db:studio` 時

**何時修改：** 更改數據庫連接信息

---

### 6. **components.json** - shadcn/ui 組件配置

**位置：** `/components.json`

**用途：** 配置 shadcn/ui 組件庫

**關鍵內容：**
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "aliasPrefix": "@",
  "aliases": {
    "components": "client/src/components",
    "utils": "client/src/lib/utils"
  }
}
```

**何時加載：** 使用 shadcn/ui CLI 添加組件時

**何時修改：** 調整組件路徑或樣式

---

### 7. **.env.example** - 環境變量模板

**位置：** `/.env.example`

**用途：** 提供環境變量配置模板

**關鍵內容：**
```env
# 數據庫
DATABASE_URL="mysql://root:root@localhost:3306/wukong_dev"

# 認證
JWT_SECRET="dev-secret-key-12345"
OAUTH_SERVER_URL="http://localhost:8080"
VITE_APP_ID="dev-app-id"
VITE_OAUTH_PORTAL_URL="http://localhost:8080/portal"

# 分析
VITE_ANALYTICS_ENDPOINT="http://localhost:3001/api/send"
VITE_ANALYTICS_WEBSITE_ID="dev-website-id"

# 應用
VITE_APP_TITLE="Wukong Dashboard"
NODE_ENV="development"

# 所有者
OWNER_NAME="Developer"
OWNER_OPEN_ID="dev-user-1"
```

**何時加載：** 項目初始化時作為參考

**何時修改：** 添加新的環境變量選項

---

### 8. **.env.local** - 本地開發環境變量

**位置：** `/.env.local` (本地，不提交)

**用途：** 本地開發環境的環境變量配置

**如何創建：**
```bash
cp .env.example .env.local
# 編輯 .env.local 填入您的實際配置
```

**關鍵內容：**
```env
DATABASE_URL="mysql://root:root@localhost:3306/wukong_dev"
JWT_SECRET="your-secret-key"
OAUTH_SERVER_URL="http://localhost:8080"
VITE_APP_ID="your-app-id"
...
```

**何時加載：** 運行 `pnpm dev` 時

**何時修改：** 更改本地開發配置

**注意：** 此文件應添加到 `.gitignore`，不應提交到 Git

---

### 9. **.env.production** - 生產環境變量

**位置：** `/.env.production` (生產服務器)

**用途：** 生產環境的環境變量配置

**關鍵內容：**
```env
DATABASE_URL="mysql://prod-user:prod-password@prod-db:3306/wukong_prod"
JWT_SECRET="production-secret-key-very-secure"
OAUTH_SERVER_URL="https://oauth.example.com"
VITE_APP_ID="production-app-id"
VITE_OAUTH_PORTAL_URL="https://oauth.example.com/portal"
VITE_ANALYTICS_ENDPOINT="https://analytics.example.com/api/send"
VITE_ANALYTICS_WEBSITE_ID="prod-website-id"
VITE_APP_TITLE="Wukong Dashboard"
NODE_ENV="production"
OWNER_NAME="Admin"
OWNER_OPEN_ID="admin-user-id"
```

**何時加載：** 部署到生產環境時

**何時修改：** 更改生產環境配置

**注意：** 此文件應安全存儲，不應提交到 Git

---

## 🔄 配置文件加載順序

```
1. package.json
   ↓
2. tsconfig.json (TypeScript 編譯)
   ↓
3. vite.config.ts (前端開發服務器)
   ↓
4. 環境變量加載
   ├── .env.local (本地開發)
   ├── .env.production (生產)
   └── process.env (系統環境變量)
   ↓
5. drizzle.config.ts (數據庫配置)
   ↓
6. server/_core/index.ts (Express 服務器啟動)
   ↓
7. server/_core/env.ts (環境變量驗證)
   ↓
8. vitest.config.ts (測試運行)
```

---

## 📊 配置文件依賴關係

```
package.json
├── tsconfig.json
├── vite.config.ts
│   └── tsconfig.json
├── vitest.config.ts
│   └── tsconfig.json
├── drizzle.config.ts
│   └── .env.local / .env.production
├── components.json
└── server/_core/index.ts
    ├── .env.local / .env.production
    ├── drizzle.config.ts
    └── server/_core/env.ts
```

---

## 🚀 常見配置場景

### 場景 1: 本地開發

**需要的配置文件：**
1. `.env.local` - 本地數據庫和 OAuth 配置
2. `vite.config.ts` - 前端開發服務器
3. `drizzle.config.ts` - 數據庫連接

**啟動命令：**
```bash
pnpm dev
```

---

### 場景 2: 運行測試

**需要的配置文件：**
1. `vitest.config.ts` - 測試框架配置
2. `tsconfig.json` - TypeScript 編譯
3. `.env.local` - 測試環境變量

**啟動命令：**
```bash
pnpm test
```

---

### 場景 3: 數據庫遷移

**需要的配置文件：**
1. `drizzle.config.ts` - 數據庫配置
2. `.env.local` - 數據庫連接信息
3. `drizzle/schema.ts` - 數據庫架構

**啟動命令：**
```bash
pnpm db:push
```

---

### 場景 4: 生產部署

**需要的配置文件：**
1. `.env.production` - 生產環境變量
2. `package.json` - 構建腳本
3. `vite.config.ts` - 前端構建配置
4. `drizzle.config.ts` - 數據庫配置

**構建命令：**
```bash
NODE_ENV=production pnpm build
```

**啟動命令：**
```bash
NODE_ENV=production pnpm start
```

---

## 🔐 環境變量安全最佳實踐

### ✅ 應該做的

1. **使用 .env.local 進行本地開發**
   ```bash
   cp .env.example .env.local
   ```

2. **將 .env.local 添加到 .gitignore**
   ```
   .env.local
   .env.production
   .env.*.local
   ```

3. **在生產環境使用密鑰管理服務**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets

4. **使用強密鑰**
   ```bash
   # 生成強密鑰
   openssl rand -base64 32
   ```

5. **定期輪換密鑰**
   - JWT_SECRET 每 90 天輪換一次
   - 數據庫密碼每 180 天輪換一次

### ❌ 不應該做的

1. **不要將 .env 文件提交到 Git**
2. **不要在代碼中硬編碼密鑰**
3. **不要在日誌中打印敏感信息**
4. **不要在版本控制中存儲生產密鑰**
5. **不要在公開倉庫中暴露環境變量**

---

## 📋 配置文件檢查清單

### 開發環境設置
- [ ] 複製 `.env.example` 到 `.env.local`
- [ ] 填入本地數據庫配置
- [ ] 填入 OAuth 配置
- [ ] 驗證 `vite.config.ts` 代理設置
- [ ] 驗證 `drizzle.config.ts` 數據庫連接

### 生產環境設置
- [ ] 創建 `.env.production` 文件
- [ ] 填入生產數據庫配置
- [ ] 填入生產 OAuth 配置
- [ ] 生成強 JWT_SECRET
- [ ] 驗證所有環境變量

### 部署前檢查
- [ ] 確認 `.env.local` 不在 Git 中
- [ ] 確認 `.env.production` 安全存儲
- [ ] 驗證所有配置文件語法
- [ ] 測試數據庫連接
- [ ] 測試 OAuth 連接

---

## 🔗 相關文檔

- [ENV_SETUP.md](./ENV_SETUP.md) - 環境變量詳細配置指南
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 開發環境設置
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 生產部署指南

---

## 📞 常見問題

### Q: 為什麼 `pnpm dev` 提示 OAUTH_SERVER_URL 未配置？

**A:** 您需要創建 `.env.local` 文件並填入 OAUTH_SERVER_URL。

```bash
cp .env.example .env.local
# 編輯 .env.local，添加 OAUTH_SERVER_URL
```

### Q: 如何在生產環境中安全存儲環境變量？

**A:** 使用以下方式之一：
- Kubernetes Secrets
- Docker Secrets
- 環境變量管理服務（AWS Secrets Manager、HashiCorp Vault）
- 配置管理工具（Ansible、Terraform）

### Q: 可以在 Git 中提交 .env 文件嗎？

**A:** 不可以。應該：
1. 將 `.env.local` 和 `.env.production` 添加到 `.gitignore`
2. 提交 `.env.example` 作為模板
3. 在部署時通過環境變量或密鑰管理服務注入實際值

### Q: 如何在 Docker 中使用環境變量？

**A:** 在 Docker 運行命令中使用 `-e` 標誌：

```bash
docker run -e DATABASE_URL="mysql://..." \
           -e JWT_SECRET="..." \
           -e OAUTH_SERVER_URL="..." \
           wukong-dashboard:latest
```

或使用 `.env` 文件：

```bash
docker run --env-file .env.production wukong-dashboard:latest
```

---

**最後更新：** 2026年1月11日
