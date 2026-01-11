# OAuth 服务器实现分析

## 📋 结论

**当前项目没有实现 OAuth 服务器**。OAuth 服务器是外部服务，需要单独部署或使用现有的 Manus OAuth 服务。

## 🔍 架构分析

### 当前项目的角色

项目作为 **OAuth 客户端**，而不是 OAuth 服务器：

1. **前端**：重定向到外部 OAuth 服务器进行登录
2. **Node.js 后端**：接收 OAuth 回调，交换 token，获取用户信息
3. **Go 后端**：只提供 Kubernetes API，不提供 OAuth 服务

### OAuth 流程

```
用户 → 前端 → 外部 OAuth 服务器 (http://192.168.1.141:8081/portal)
                ↓
            用户授权
                ↓
外部 OAuth 服务器 → 回调到 Node.js 后端 (/api/oauth/callback)
                ↓
Node.js 后端 → 调用外部 OAuth API 交换 token
                ↓
Node.js 后端 → 获取用户信息
                ↓
Node.js 后端 → 创建 session cookie
                ↓
重定向到前端首页
```

## 📝 代码证据

### 1. SDK 调用外部 OAuth API

```typescript
// server/_core/sdk.ts
const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    // 这里调用的是外部 OAuth 服务器的 API
  }
}
```

### 2. 前端重定向到外部 OAuth

```typescript
// client/src/const.ts
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL; // 外部 OAuth 服务器
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  // ...
};
```

### 3. Go 后端只提供 Kubernetes API

```go
// go-backend/cmd/server/main.go
// 只实现了：
// - /api/vms/* (虚拟机管理)
// - /api/snapshots/* (快照管理)
// - /api/ws (WebSocket)
// 没有 OAuth 相关的路由
```

## 🎯 解决方案

### 选项 1：使用现有的 Manus OAuth 服务（推荐）

如果你的环境中有 Manus OAuth 服务运行在 `http://192.168.1.141:8081/portal`，确保：

1. OAuth 服务正在运行
2. 配置了正确的 `appId`
3. 回调 URL 配置正确

### 选项 2：部署独立的 OAuth 服务器

需要部署一个支持以下 API 的 OAuth 服务器：

- `POST /webdev.v1.WebDevAuthPublicService/ExchangeToken` - 交换授权码
- `POST /webdev.v1.WebDevAuthPublicService/GetUserInfo` - 获取用户信息
- `GET /portal/app-auth` - 登录页面

### 选项 3：临时禁用认证（开发环境）

如果只是测试功能，可以：

1. 修改 `protectedProcedure` 为 `publicProcedure`
2. 或者创建一个 mock 用户用于测试

## 🔧 检查 OAuth 服务器是否运行

```bash
# 检查 OAuth 服务器健康状态
curl http://192.168.1.141:8081/portal/health

# 检查登录页面是否可访问
curl http://192.168.1.141:8081/portal/app-auth
```

## 📚 相关配置

### 环境变量

```env
# OAuth 服务器 URL（外部服务）
OAUTH_SERVER_URL="http://192.168.1.141:8081"
VITE_OAUTH_PORTAL_URL="http://192.168.1.141:8081/portal"

# OAuth 应用 ID
VITE_APP_ID="dev-app-id"
```

### 当前配置检查

根据你的 `.env.local`：
- `VITE_OAUTH_PORTAL_URL="http://192.168.1.141:8081/portal"`
- `VITE_APP_ID="dev-app-id"`

这意味着系统期望有一个 OAuth 服务器运行在 `http://192.168.1.141:8081/portal`。

## ⚠️ 注意事项

1. **OAuth 服务器是外部依赖**：如果 OAuth 服务器不可用，用户无法登录
2. **Go 后端端口**：Go 后端默认运行在 8085 端口（可通过 PORT 环境变量配置），不是 8081
3. **端口冲突**：如果 OAuth 服务器和 Go 后端都使用 8081，会有端口冲突

## 🚀 下一步

1. **确认 OAuth 服务器状态**：检查 `http://192.168.1.141:8081/portal` 是否可访问
2. **如果 OAuth 服务器不存在**：
   - 部署 Manus OAuth 服务
   - 或使用其他 OAuth 提供商（需要修改代码）
   - 或临时禁用认证（仅开发环境）

---

**最后更新：** 2026-01-11

