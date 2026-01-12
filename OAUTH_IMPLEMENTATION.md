# OAuth 服务器实现方案

本文档说明如何在当前项目中实现 OAuth 服务器，可以选择 Node.js (TypeScript) 或 Golang 两种方案。

## 📋 项目架构分析

当前项目包含三个主要组件：

| 组件 | 位置 | 技术栈 | 职责 |
|------|------|--------|------|
| **前端** | `/client` | React 19 + TypeScript | UI 界面 |
| **Node.js 后端** | `/server` | Express + tRPC + Drizzle ORM | API 服务、业务逻辑、认证处理 |
| **Go 后端** | `/go-backend` | Gin + client-go | Kubernetes API、VM 管理、WebSocket |

## 🎯 实现方案对比

### 方案 1: Node.js (TypeScript) 实现 ⭐ 推荐

**实现位置：** 可以创建独立的 OAuth 服务，或在现有的 Node.js 后端中添加

#### 优点
- ✅ **代码基础好**：已有 OAuth SDK (`server/_core/sdk.ts`) 和回调处理 (`server/_core/oauth.ts`)
- ✅ **数据库集成方便**：可以直接使用现有的 Drizzle ORM 和数据库连接
- ✅ **类型定义完整**：已有 TypeScript 类型定义 (`server/_core/types/manusTypes.ts`)
- ✅ **开发速度快**：可以复用现有代码

#### 缺点
- ❌ 需要单独的服务实例或端口
- ❌ 如果独立部署，需要额外的部署配置

#### 实现方式

**选项 A：独立 OAuth 服务**（推荐）

创建新的 OAuth 服务器目录：

```
wukong-dashboard/
├── oauth-server/          # 新建 OAuth 服务器
│   ├── src/
│   │   ├── server.ts      # Express 服务器
│   │   ├── routes/
│   │   │   ├── auth.ts    # /portal/app-auth 路由
│   │   │   └── api.ts     # OAuth API 路由
│   │   ├── services/
│   │   │   ├── oauth.ts   # OAuth 业务逻辑
│   │   │   └── token.ts   # Token 生成和验证
│   │   └── db.ts          # 数据库操作（可以复用 server/db.ts）
│   ├── package.json
│   └── tsconfig.json
```

http://192.168.1.141:3000/portal/app-auth?appId=dev-app-id&redirectUri=http://192.168.1.141:3000/api/oauth/callback&state=xxx
**选项 B：集成到现有 Node.js 后端**

在 `server/_core/index.ts` 中添加 OAuth 服务器路由：

```typescript
// 添加 OAuth 服务器路由
import { registerOAuthServerRoutes } from "./oauthServer";

// 在 Express app 中注册
registerOAuthServerRoutes(app);
```

### 方案 2: Golang 实现

**实现位置：** `go-backend/pkg/oauth/`

#### 优点
- ✅ **性能好**：Go 语言性能优异
- ✅ **代码结构统一**：与现有的 Go 后端代码结构一致
- ✅ **可以集成到现有服务**：可以添加到 `go-backend/cmd/server/main.go` 中
- ✅ **部署简单**：如果集成到 Go 后端，不需要额外的服务

#### 缺点
- ❌ 需要重新实现所有功能
- ❌ 需要实现数据库连接（可以使用现有的 MySQL 连接）
- ❌ 需要实现类型定义（需要对应 TypeScript 类型）

#### 实现方式

在 `go-backend` 中添加 OAuth 服务：

```
go-backend/
├── cmd/server/
│   └── main.go              # 添加 OAuth 路由
├── pkg/
│   ├── oauth/               # 新建 OAuth 包
│   │   ├── handler.go       # HTTP 处理器
│   │   ├── service.go       # OAuth 业务逻辑
│   │   ├── token.go         # Token 生成和验证
│   │   └── database.go      # 数据库操作
│   └── ...
```

## 🔧 需要实现的接口

无论选择哪种方案，都需要实现以下接口：

### 1. 登录门户页面

**端点：** `GET /portal/app-auth`

**功能：**
- 显示登录/注册页面
- 支持 Google/Microsoft/Apple/Email 登录
- 生成授权码
- 重定向到回调 URL

### 2. 交换授权码

**端点：** `POST /webdev.v1.WebDevAuthPublicService/ExchangeToken`

**请求体：**
```json
{
  "clientId": "app-id",
  "grantType": "authorization_code",
  "code": "authorization_code",
  "redirectUri": "http://localhost:3000/api/oauth/callback"
}
```

**响应体：**
```json
{
  "accessToken": "access_token",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "refreshToken": "refresh_token",
  "scope": "openid profile email",
  "idToken": "id_token"
}
```

### 3. 获取用户信息

**端点：** `POST /webdev.v1.WebDevAuthPublicService/GetUserInfo`

**请求体：**
```json
{
  "accessToken": "access_token"
}
```

**响应体：**
```json
{
  "openId": "user_unique_id",
  "projectId": "app-id",
  "name": "User Name",
  "email": "user@example.com",
  "platform": "google",
  "loginMethod": "google"
}
```

### 4. 使用 JWT 获取用户信息（可选）

**端点：** `POST /webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`

**请求体：**
```json
{
  "jwtToken": "jwt_token",
  "projectId": "app-id"
}
```

## 💡 推荐方案

### 推荐：Node.js (TypeScript) - 独立 OAuth 服务

**理由：**
1. **开发效率高**：可以复用现有的 OAuth SDK 代码和数据库操作
2. **代码基础好**：已有完整的类型定义和业务逻辑参考
3. **易于维护**：使用相同的技术栈，团队熟悉度高
4. **灵活部署**：可以独立部署，也可以集成到现有服务

### 实现步骤（Node.js 独立服务）

#### 步骤 1: 创建 OAuth 服务器目录结构

```bash
mkdir -p oauth-server/src/{routes,services}
cd oauth-server
npm init -y
```

#### 步骤 2: 安装依赖

```bash
pnpm add express dotenv
pnpm add -D @types/express @types/node typescript tsx
```

#### 步骤 3: 实现核心文件

**`oauth-server/src/server.ts`**
```typescript
import express from 'express';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth';
import { apiRoutes } from './routes/api';

dotenv.config();

const app = express();
app.use(express.json());

// 注册路由
app.use('/portal', authRoutes);
app.use('/', apiRoutes);

const port = process.env.PORT || 8081;
app.listen(port, () => {
  console.log(`OAuth server running on port ${port}`);
});
```

**`oauth-server/src/routes/auth.ts`**
```typescript
import { Router } from 'express';
import { handleAuthPage } from '../services/oauth';

export const authRoutes = Router();

authRoutes.get('/app-auth', async (req, res) => {
  const { appId, redirectUri, state, type, provider } = req.query;
  
  // 验证参数
  if (!appId || !redirectUri || !state) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  // 显示登录页面或处理登录逻辑
  // ...
});
```

**`oauth-server/src/services/oauth.ts`**
```typescript
import { db } from '../../server/db'; // 复用数据库连接

export async function generateAuthorizationCode(
  appId: string,
  redirectUri: string,
  userId: string
): Promise<string> {
  // 生成授权码
  const code = generateRandomCode();
  
  // 保存授权码到数据库或缓存（带过期时间）
  await saveAuthorizationCode(code, appId, redirectUri, userId);
  
  return code;
}

export async function exchangeCodeForToken(
  code: string,
  appId: string,
  redirectUri: string
) {
  // 验证授权码
  const authCode = await verifyAuthorizationCode(code, appId, redirectUri);
  if (!authCode) {
    throw new Error('Invalid authorization code');
  }
  
  // 生成访问令牌
  const accessToken = generateAccessToken(authCode.userId);
  const idToken = generateIdToken(authCode.userId);
  
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 3600,
    scope: 'openid profile email',
    idToken,
  };
}

export async function getUserInfo(accessToken: string) {
  // 验证访问令牌
  const tokenData = await verifyAccessToken(accessToken);
  if (!tokenData) {
    throw new Error('Invalid access token');
  }
  
  // 获取用户信息
  const user = await db.getUserById(tokenData.userId);
  
  return {
    openId: user.openId,
    projectId: tokenData.appId,
    name: user.name,
    email: user.email,
    platform: user.loginMethod,
    loginMethod: user.loginMethod,
  };
}
```

#### 步骤 4: 配置环境变量

**`oauth-server/.env`**
```env
PORT=8081
DATABASE_URL="mysql://root:@192.168.1.142:4000/wukong_dev"
JWT_SECRET="your-jwt-secret"
```

#### 步骤 5: 更新现有配置

确保 Node.js 后端和前端能够连接到新的 OAuth 服务器：

**`.env.local`**
```env
OAUTH_SERVER_URL="http://localhost:8081"
VITE_OAUTH_PORTAL_URL="http://localhost:8081/portal"
```

### 备选方案：Golang 实现

如果选择 Golang 实现，可以：

1. **集成到现有 Go 后端**：在 `go-backend/cmd/server/main.go` 中添加 OAuth 路由
2. **独立服务**：创建新的 `oauth-go` 目录，作为独立服务

#### 示例代码结构（Golang）

**`go-backend/pkg/oauth/handler.go`**
```go
package oauth

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

type OAuthHandler struct {
	service *OAuthService
}

func NewOAuthHandler(service *OAuthService) *OAuthHandler {
	return &OAuthHandler{service: service}
}

func (h *OAuthHandler) AppAuth(c *gin.Context) {
	appId := c.Query("appId")
	redirectUri := c.Query("redirectUri")
	state := c.Query("state")
	
	// 处理登录页面
	// ...
}

func (h *OAuthHandler) ExchangeToken(c *gin.Context) {
	var req ExchangeTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	token, err := h.service.ExchangeCodeForToken(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, token)
}
```

**在 `go-backend/cmd/server/main.go` 中注册路由：**
```go
import (
	"github.com/kuihuar/wukong-dashboard/go-backend/pkg/oauth"
)

func main() {
	// ... 现有代码 ...
	
	// 初始化 OAuth 处理器
	oauthService := oauth.NewOAuthService(db)
	oauthHandler := oauth.NewOAuthHandler(oauthService)
	
	// 注册 OAuth 路由
	portal := router.Group("/portal")
	{
		portal.GET("/app-auth", oauthHandler.AppAuth)
	}
	
	api := router.Group("/webdev.v1.WebDevAuthPublicService")
	{
		api.POST("/ExchangeToken", oauthHandler.ExchangeToken)
		api.POST("/GetUserInfo", oauthHandler.GetUserInfo)
	}
	
	// ... 现有代码 ...
}
```

## 📊 方案对比总结

| 特性 | Node.js (TypeScript) | Golang |
|------|---------------------|--------|
| 开发速度 | ⭐⭐⭐⭐⭐ 快 | ⭐⭐⭐ 中等 |
| 代码复用 | ⭐⭐⭐⭐⭐ 高 | ⭐⭐ 低 |
| 性能 | ⭐⭐⭐ 良好 | ⭐⭐⭐⭐⭐ 优秀 |
| 代码维护 | ⭐⭐⭐⭐ 容易 | ⭐⭐⭐ 中等 |
| 部署复杂度 | ⭐⭐⭐ 中等 | ⭐⭐⭐⭐ 简单 |
| 团队熟悉度 | ⭐⭐⭐⭐⭐ 高 | ⭐⭐⭐ 中等 |

## 🚀 快速开始（Node.js 方案）

如果你选择 Node.js 方案，我可以帮你创建完整的 OAuth 服务器代码结构。

## 📚 相关文件

- `server/_core/sdk.ts` - OAuth SDK 客户端实现（参考）
- `server/_core/oauth.ts` - OAuth 回调处理（参考）
- `server/_core/types/manusTypes.ts` - OAuth API 类型定义（参考）
- `server/db.ts` - 数据库操作（可复用）
- `go-backend/cmd/server/main.go` - Go 后端服务器入口（如果要集成）

## 🔗 相关文档

- [OAuth 配置文档](./OAUTH_CONFIG.md) - 详细的接口规范
- [环境变量配置](./ENV_SETUP.md) - 环境变量说明

