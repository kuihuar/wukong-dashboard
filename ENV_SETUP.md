# 環境變量配置指南

本文檔說明如何配置 Wukong Dashboard 的環境變量。

## 📋 目錄

- [快速開始](#快速開始)
- [環境變量說明](#環境變量說明)
- [開發環境配置](#開發環境配置)
- [生產環境配置](#生產環境配置)
- [常見問題](#常見問題)

## 🚀 快速開始

### 1. 創建 .env.local 文件

```bash
cd /path/to/wukong-dashboard
cp .env.example .env.local  # 如果存在模板
# 或手動創建
touch .env.local
```

### 2. 配置必需的環境變量

最少需要配置以下變量才能啟動開發服務器：

```env
# 數據庫
DATABASE_URL="mysql://root:root@localhost:3306/wukong_dev"

# OAuth
OAUTH_SERVER_URL="http://localhost:8080"
VITE_APP_ID="dev-app-id"
VITE_OAUTH_PORTAL_URL="http://localhost:8080/portal"

# JWT
JWT_SECRET="dev-secret-key"

# 分析（可選，但需要定義以避免警告）
VITE_ANALYTICS_ENDPOINT="http://localhost:3001/api/send"
VITE_ANALYTICS_WEBSITE_ID="dev-website-id"
```

### 3. 啟動開發服務器

```bash
pnpm dev
```

## 📝 環境變量說明

### 必需變量

#### 數據庫配置

| 變量 | 說明 | 示例 |
|------|------|------|
| `DATABASE_URL` | MySQL/TiDB 連接字符串 | `mysql://root:root@localhost:3306/wukong_dev` |

**格式：** `mysql://[username]:[password]@[host]:[port]/[database]`

**示例：**
- 本地 MySQL: `mysql://root:root@localhost:3306/wukong_dev`
- TiDB 云: `mysql://root:password@tidb-host:4000/wukong`
- Docker MySQL: `mysql://root:root@mysql:3306/wukong_dev`

#### 認證配置

| 變量 | 說明 | 示例 |
|------|------|------|
| `JWT_SECRET` | JWT 簽名密鑰 | `your-super-secret-key` |
| `OAUTH_SERVER_URL` | OAuth 服務器 URL | `http://localhost:8080` |
| `VITE_APP_ID` | OAuth 應用 ID | `dev-app-id` |
| `VITE_OAUTH_PORTAL_URL` | OAuth 登錄門戶 URL | `http://localhost:8080/portal` |

**JWT_SECRET 要求：**
- 開發環境：任意字符串（最少 8 個字符）
- 生產環境：強隨機字符串（最少 32 個字符）

**生成安全的 JWT_SECRET：**
```bash
# Linux/macOS
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 可選變量

#### 分析配置

| 變數 | 說明 | 示例 |
|------|------|------|
| `VITE_ANALYTICS_ENDPOINT` | 分析服務端點 | `http://localhost:3001/api/send` |
| `VITE_ANALYTICS_WEBSITE_ID` | 分析網站 ID | `dev-website-id` |

**支持的分析服務：**
- Umami: `http://umami-host:3000/api/send`
- Plausible: `https://plausible.io/api/event`
- 自定義服務

**如果不使用分析：**
```env
VITE_ANALYTICS_ENDPOINT=""
VITE_ANALYTICS_WEBSITE_ID=""
```

#### 應用配置

| 變數 | 說明 | 示例 |
|------|------|------|
| `VITE_APP_TITLE` | 應用標題 | `Wukong Dashboard` |
| `VITE_APP_LOGO` | 應用 Logo 路徑 | `/logo.png` |
| `NODE_ENV` | Node 環境 | `development` 或 `production` |

#### 所有者信息

| 變數 | 說明 | 示例 |
|------|------|------|
| `OWNER_NAME` | 所有者名稱 | `Admin` |
| `OWNER_OPEN_ID` | 所有者 ID | `admin-user-1` |

#### Kubernetes 配置（可選）

| 變數 | 說明 | 示例 |
|------|------|------|
| `KUBERNETES_API_URL` | Kubernetes API 服務器 | `https://kubernetes-api:6443` |
| `KUBERNETES_NAMESPACE` | Kubernetes 命名空間 | `wukong` |
| `KUBECONFIG` | kubeconfig 文件路徑 | `/path/to/kubeconfig` |

## 🔧 開發環境配置

### 完整的開發環境 .env.local

```env
# ============================================
# 開發環境配置
# ============================================

# 數據庫（本地 MySQL）
DATABASE_URL="mysql://root:root@localhost:3306/wukong_dev"

# 認證
JWT_SECRET="dev-secret-key-12345"
OAUTH_SERVER_URL="http://localhost:8080"
VITE_APP_ID="dev-app-id"
VITE_OAUTH_PORTAL_URL="http://localhost:8080/portal"

# 應用
VITE_APP_TITLE="Wukong Dashboard (Dev)"
VITE_APP_LOGO="/logo.png"
NODE_ENV="development"

# 分析
VITE_ANALYTICS_ENDPOINT="http://localhost:3001/api/send"
VITE_ANALYTICS_WEBSITE_ID="dev-website-id"

# 所有者
OWNER_NAME="Developer"
OWNER_OPEN_ID="dev-user-1"

# 日誌級別
LOG_LEVEL="debug"
```

### 使用 Docker MySQL 的開發環境

```bash
# 1. 啟動 MySQL 容器
docker run -d \
  --name wukong-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=wukong_dev \
  -p 3306:3306 \
  mysql:8.0

# 2. 等待 MySQL 啟動
sleep 10

# 3. 創建 .env.local
cat > .env.local << 'EOF'
DATABASE_URL="mysql://root:root@localhost:3306/wukong_dev"
JWT_SECRET="dev-secret-key"
OAUTH_SERVER_URL="http://localhost:8080"
VITE_APP_ID="dev-app-id"
VITE_OAUTH_PORTAL_URL="http://localhost:8080/portal"
VITE_ANALYTICS_ENDPOINT="http://localhost:3001/api/send"
VITE_ANALYTICS_WEBSITE_ID="dev-website-id"
EOF

# 4. 初始化數據庫
pnpm db:push

# 5. 啟動開發服務器
pnpm dev
```

### 使用 Docker Compose 的開發環境

創建 `docker-compose.dev.yml`：

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: wukong_dev
    ports:
      - "3306:3306"
    volumes:
      - mysql-dev-data:/var/lib/mysql

volumes:
  mysql-dev-data:
```

啟動：

```bash
docker-compose -f docker-compose.dev.yml up -d
pnpm db:push
pnpm dev
```

## 🏢 生產環境配置

### 生產環境 .env 要求

```env
# ============================================
# 生產環境配置
# ============================================

# 數據庫（使用強密碼）
DATABASE_URL="mysql://wukong:strong-password@db-host:3306/wukong_prod"

# 認證（使用強密鑰）
JWT_SECRET="$(openssl rand -base64 32)"
OAUTH_SERVER_URL="https://oauth.example.com"
VITE_APP_ID="prod-app-id"
VITE_OAUTH_PORTAL_URL="https://oauth.example.com/portal"

# 應用
VITE_APP_TITLE="Wukong Dashboard"
VITE_APP_LOGO="/logo.png"
NODE_ENV="production"

# 分析（使用生產服務）
VITE_ANALYTICS_ENDPOINT="https://analytics.example.com/api/send"
VITE_ANALYTICS_WEBSITE_ID="prod-website-id"

# 所有者
OWNER_NAME="Admin"
OWNER_OPEN_ID="admin-prod-id"

# 日誌級別
LOG_LEVEL="info"
```

### 生產環境檢查清單

- [ ] 所有 URL 使用 HTTPS
- [ ] JWT_SECRET 是強隨機字符串
- [ ] 數據庫密碼是強密碼
- [ ] NODE_ENV 設置為 "production"
- [ ] 日誌級別設置為 "info" 或 "warn"
- [ ] 分析服務已配置
- [ ] 備份策略已制定
- [ ] 監控已設置

## 🔍 常見問題

### Q1: 啟動時出現 "OAUTH_SERVER_URL is not configured" 錯誤

**原因：** 缺少 `OAUTH_SERVER_URL` 環境變量

**解決方案：**
```bash
# 檢查 .env.local 是否存在
ls -la .env.local

# 確保包含以下行
echo 'OAUTH_SERVER_URL="http://localhost:8080"' >> .env.local

# 重啟開發服務器
pnpm dev
```

### Q2: 出現 "%VITE_ANALYTICS_ENDPOINT% is not defined" 警告

**原因：** 缺少分析相關的環境變量

**解決方案：**
```bash
# 添加到 .env.local
echo 'VITE_ANALYTICS_ENDPOINT="http://localhost:3001/api/send"' >> .env.local
echo 'VITE_ANALYTICS_WEBSITE_ID="dev-website-id"' >> .env.local

# 或者留空（禁用分析）
echo 'VITE_ANALYTICS_ENDPOINT=""' >> .env.local
echo 'VITE_ANALYTICS_WEBSITE_ID=""' >> .env.local
```

### Q3: 數據庫連接失敗

**原因：** `DATABASE_URL` 配置錯誤或數據庫未運行

**解決方案：**
```bash
# 1. 檢查 DATABASE_URL 格式
cat .env.local | grep DATABASE_URL

# 2. 測試數據庫連接
mysql -u root -p -h localhost

# 3. 確保數據庫已創建
mysql -u root -p -e "SHOW DATABASES;"

# 4. 如果使用 Docker，檢查容器狀態
docker ps | grep mysql
```

### Q4: 如何更改環境變量而不重啟服務器？

**不可以。** 環境變量在啟動時讀取，更改後需要重啟服務器：

```bash
# 1. 停止開發服務器 (Ctrl+C)
# 2. 編輯 .env.local
# 3. 重啟服務器
pnpm dev
```

### Q5: 如何在不同環境間切換？

**方案 1：使用多個 .env 文件**
```bash
# 開發環境
cp .env.local .env.dev
# 編輯 .env.dev

# 生產環境
cp .env.local .env.prod
# 編輯 .env.prod

# 使用特定環境
NODE_ENV=development pnpm dev
NODE_ENV=production pnpm build
```

**方案 2：使用環境變量覆蓋**
```bash
OAUTH_SERVER_URL="http://prod-oauth:8080" pnpm dev
```

## 📚 更多資源

- [開發指南](./DEVELOPMENT.md) - 詳細的開發環境設置
- [部署指南](./DEPLOYMENT.md) - 生產部署配置
- [README](./README.md) - 項目概述

---

**最後更新：** 2026-01-10
