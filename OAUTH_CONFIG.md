# OAuth 服务配置文档

本文档说明如何配置和开发自定义 OAuth 服务器，以及 `OAUTH_SERVER_URL` 和 `VITE_OAUTH_PORTAL_URL` 两个环境变量的使用。

## 📋 概述

Wukong Dashboard 使用自定义 OAuth 服务器进行用户认证。需要配置两个环境变量来连接 OAuth 服务：

- **`OAUTH_SERVER_URL`**: 后端服务器使用的 OAuth API 基础 URL
- **`VITE_OAUTH_PORTAL_URL`**: 前端使用的 OAuth 登录门户 URL

## 🔧 环境变量说明

### 1. `OAUTH_SERVER_URL`

**用途：** Node.js 后端服务器调用 OAuth API 的基础 URL

**使用位置：**
- `server/_core/sdk.ts` - OAuth SDK 客户端配置
- `server/_core/oauth.ts` - OAuth 回调处理

**配置示例：**
```env
# 开发环境
OAUTH_SERVER_URL="http://192.168.1.141:8081"

# 生产环境
OAUTH_SERVER_URL="https://oauth.example.com"
```

**注意事项：**
- 必须是完整的 URL（包含协议 `http://` 或 `https://`）
- 不包含路径，只包含协议、主机和端口
- 后端服务器必须能够访问此 URL

### 2. `VITE_OAUTH_PORTAL_URL`

**用途：** 前端浏览器重定向到 OAuth 登录页面的 URL

**使用位置：**
- `client/src/const.ts` - 生成登录 URL

**配置示例：**
```env
# 开发环境
VITE_OAUTH_PORTAL_URL="http://192.168.1.141:8081/portal"

# 生产环境
VITE_OAUTH_PORTAL_URL="https://oauth.example.com/portal"
```

**注意事项：**
- 必须是完整的 URL（包含协议 `http://` 或 `https://`）
- 通常包含 `/portal` 路径
- 浏览器必须能够访问此 URL
- 使用 `VITE_` 前缀，表示这是 Vite 构建时的环境变量

## 🏗️ OAuth 服务器需要实现的接口

### 1. 登录门户页面

**端点：** `GET ${VITE_OAUTH_PORTAL_URL}/app-auth`

**查询参数：**
- `appId` (string): 应用 ID，来自 `VITE_APP_ID` 环境变量
- `redirectUri` (string): 回调 URL，格式为 `${window.location.origin}/api/oauth/callback`
- `state` (string): Base64 编码的 redirectUri，用于状态验证
- `type` (string): 登录类型，`"signIn"` 或 `"signUp"`
- `provider` (string, 可选): 登录提供商，`"google"` | `"microsoft"` | `"apple"` | `"email"`

**功能：**
- 显示登录/注册页面
- 支持多种登录方式（Google、Microsoft、Apple、Email）
- 用户登录后，重定向到 `redirectUri`，并携带 `code` 和 `state` 参数

**示例请求：**
```
GET /portal/app-auth?appId=dev-app-id&redirectUri=http://localhost:3000/api/oauth/callback&state=xxx&type=signUp&provider=google
```

**示例响应：**
```
HTTP/1.1 302 Found
Location: http://localhost:3000/api/oauth/callback?code=AUTHORIZATION_CODE&state=xxx
```

### 2. 交换授权码获取访问令牌

**端点：** `POST ${OAUTH_SERVER_URL}/webdev.v1.WebDevAuthPublicService/ExchangeToken`

**请求体：**
```typescript
interface ExchangeTokenRequest {
  clientId: string;        // 应用 ID，来自 VITE_APP_ID
  grantType: string;       // "authorization_code"
  code: string;            // 授权码
  redirectUri: string;     // 回调 URL（从 state 中解码）
}
```

**响应体：**
```typescript
interface ExchangeTokenResponse {
  accessToken: string;     // 访问令牌
  tokenType: string;       // 通常是 "Bearer"
  expiresIn: number;       // 过期时间（秒）
  refreshToken?: string;   // 刷新令牌（可选）
  scope: string;           // 权限范围
  idToken: string;        // ID 令牌
}
```

**功能：**
- 验证授权码
- 验证 redirectUri 是否匹配
- 返回访问令牌和 ID 令牌

### 3. 获取用户信息

**端点：** `POST ${OAUTH_SERVER_URL}/webdev.v1.WebDevAuthPublicService/GetUserInfo`

**请求体：**
```typescript
interface GetUserInfoRequest {
  accessToken: string;     // 从 ExchangeToken 获取的访问令牌
}
```

**响应体：**
```typescript
interface GetUserInfoResponse {
  openId: string;          // 用户唯一标识符（必需）
  projectId: string;       // 项目 ID
  name: string;            // 用户名称
  email?: string | null;   // 用户邮箱（可选）
  platform?: string | null; // 登录平台（可选）
  loginMethod?: string | null; // 登录方式（可选）
}
```

**功能：**
- 验证访问令牌
- 返回用户信息
- `openId` 字段是必需的，用于标识用户

### 4. 使用 JWT 获取用户信息（可选）

**端点：** `POST ${OAUTH_SERVER_URL}/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`

**请求体：**
```typescript
interface GetUserInfoWithJwtRequest {
  jwtToken: string;        // JWT 令牌
  projectId: string;       // 项目 ID，来自 VITE_APP_ID
}
```

**响应体：**
```typescript
interface GetUserInfoWithJwtResponse {
  openId: string;          // 用户唯一标识符
  projectId: string;       // 项目 ID
  name: string;            // 用户名称
  email?: string | null;   // 用户邮箱
  platform?: string | null; // 登录平台
  loginMethod?: string | null; // 登录方式
}
```

**功能：**
- 验证 JWT 令牌
- 返回用户信息
- 用于从 session cookie 中恢复用户信息

## 🔄 OAuth 认证流程

### 完整流程图

```
1. 用户点击登录按钮（前端）
   ↓
2. 前端构建登录 URL 并重定向
   ${VITE_OAUTH_PORTAL_URL}/app-auth?appId=xxx&redirectUri=xxx&state=xxx&type=signUp&provider=google
   ↓
3. OAuth 服务器显示登录页面
   - 支持 Google/Microsoft/Apple/Email 登录
   ↓
4. 用户选择登录方式并完成认证
   ↓
5. OAuth 服务器重定向回应用
   ${window.location.origin}/api/oauth/callback?code=AUTHORIZATION_CODE&state=xxx
   ↓
6. 后端接收回调，调用 ExchangeToken API
   POST ${OAUTH_SERVER_URL}/webdev.v1.WebDevAuthPublicService/ExchangeToken
   ↓
7. 后端获取访问令牌后，调用 GetUserInfo API
   POST ${OAUTH_SERVER_URL}/webdev.v1.WebDevAuthPublicService/GetUserInfo
   ↓
8. 后端保存用户信息到数据库
   ↓
9. 后端创建 JWT session token
   ↓
10. 后端设置 session cookie
    ↓
11. 重定向到首页
```

### 代码实现位置

#### 前端登录 URL 生成 (`client/src/const.ts`)

```typescript
export const getLoginUrl = (options?: {
  type?: "signIn" | "signUp";
  provider?: "google" | "microsoft" | "apple" | "email";
}) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", options?.type || "signIn");
  
  if (options?.provider) {
    url.searchParams.set("provider", options.provider);
  }

  return url.toString();
};
```

#### 后端 OAuth 回调处理 (`server/_core/oauth.ts`)

```typescript
app.get("/api/oauth/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  // 1. 交换授权码获取访问令牌
  const tokenResponse = await sdk.exchangeCodeForToken(code, state);
  
  // 2. 获取用户信息
  const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
  
  // 3. 保存用户到数据库
  await db.upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn: new Date(),
  });
  
  // 4. 创建 session token
  const sessionToken = await sdk.createSessionToken(userInfo.openId, {
    name: userInfo.name || "",
    expiresInMs: ONE_YEAR_MS,
  });
  
  // 5. 设置 session cookie
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  
  // 6. 重定向到首页
  res.redirect(302, "/");
});
```

#### 后端 OAuth SDK (`server/_core/sdk.ts`)

```typescript
// API 端点定义
const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

// HTTP 客户端配置
const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,  // 使用 OAUTH_SERVER_URL
    timeout: AXIOS_TIMEOUT_MS,
  });

// 交换授权码
async getTokenByCode(code: string, state: string) {
  const payload = {
    clientId: ENV.appId,
    grantType: "authorization_code",
    code,
    redirectUri: atob(state),  // 从 state 中解码 redirectUri
  };
  
  const { data } = await this.client.post(EXCHANGE_TOKEN_PATH, payload);
  return data;
}

// 获取用户信息
async getUserInfoByToken(token: ExchangeTokenResponse) {
  const { data } = await this.client.post(GET_USER_INFO_PATH, {
    accessToken: token.accessToken,
  });
  return data;
}
```

## 📝 配置示例

### 开发环境配置 (`.env.local`)

```env
# OAuth 服务器配置
OAUTH_SERVER_URL="http://192.168.1.141:8081"
VITE_OAUTH_PORTAL_URL="http://192.168.1.141:8081/portal"
VITE_APP_ID="dev-app-id"
```

### 生产环境配置

```env
# OAuth 服务器配置
OAUTH_SERVER_URL="https://oauth.example.com"
VITE_OAUTH_PORTAL_URL="https://oauth.example.com/portal"
VITE_APP_ID="prod-app-id"
```

## 🛠️ OAuth 服务器开发指南

### 需要实现的功能

1. **登录门户页面** (`/portal/app-auth`)
   - 显示登录/注册界面
   - 支持多种登录方式（Google、Microsoft、Apple、Email）
   - 处理用户认证
   - 生成授权码
   - 重定向到回调 URL

2. **Token 交换 API** (`/webdev.v1.WebDevAuthPublicService/ExchangeToken`)
   - 验证授权码
   - 验证 redirectUri
   - 生成访问令牌和 ID 令牌
   - 返回令牌信息

3. **用户信息 API** (`/webdev.v1.WebDevAuthPublicService/GetUserInfo`)
   - 验证访问令牌
   - 返回用户信息
   - 必须包含 `openId` 字段

4. **JWT 用户信息 API** (`/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`) - 可选
   - 验证 JWT 令牌
   - 返回用户信息

### 安全注意事项

1. **授权码验证**
   - 授权码应该是一次性的
   - 授权码应该有过期时间（通常 10 分钟）
   - 验证 redirectUri 是否与注册时的一致

2. **访问令牌验证**
   - 访问令牌应该有过期时间
   - 使用安全的签名算法（如 HS256）
   - 存储令牌与用户的映射关系

3. **状态参数**
   - 使用 state 参数防止 CSRF 攻击
   - 验证 state 参数的有效性

4. **HTTPS**
   - 生产环境必须使用 HTTPS
   - 保护令牌传输安全

## ⚠️ 常见问题

### Q1: 为什么需要两个不同的 URL？

**A:** 因为使用场景不同：
- `OAUTH_SERVER_URL`: 后端服务器之间的 API 调用（Server-to-Server）
- `VITE_OAUTH_PORTAL_URL`: 浏览器重定向到登录页面（Browser-to-Server）

在某些部署场景中，这两个 URL 可能不同：
- 内网服务器访问：`http://internal-oauth:8081`
- 外网浏览器访问：`https://oauth.example.com/portal`

### Q2: 两个 URL 可以相同吗？

**A:** 可以，如果 OAuth 服务器同时提供 API 和门户服务，可以设置为：
```env
OAUTH_SERVER_URL="http://192.168.1.141:8081"
VITE_OAUTH_PORTAL_URL="http://192.168.1.141:8081/portal"
```

### Q3: 启动时提示 "OAUTH_SERVER_URL is not configured"

**A:** 检查 `.env.local` 文件是否包含 `OAUTH_SERVER_URL`，并确保：
1. 文件路径正确
2. 环境变量名称拼写正确
3. 值包含在引号中（如果包含特殊字符）
4. 服务器已重启以加载新配置

### Q4: OAuth 回调失败，提示 "code and state are required"

**A:** 检查：
1. OAuth 服务器是否正确重定向到回调 URL
2. 回调 URL 中是否包含 `code` 和 `state` 参数
3. 检查浏览器网络请求，查看回调 URL 的完整参数

### Q5: ExchangeToken 返回错误

**A:** 检查：
1. `OAUTH_SERVER_URL` 是否正确
2. 授权码是否有效（未过期、未使用）
3. `redirectUri` 是否与注册时的一致
4. `clientId` (appId) 是否正确

## 🔍 调试方法

### 1. 检查环境变量是否加载

在 `server/_core/env.ts` 中添加日志：
```typescript
console.log(`[Env] OAUTH_SERVER_URL="${ENV.oAuthServerUrl}"`);
```

### 2. 检查前端环境变量

在浏览器控制台运行：
```javascript
console.log('VITE_OAUTH_PORTAL_URL:', import.meta.env.VITE_OAUTH_PORTAL_URL);
console.log('VITE_APP_ID:', import.meta.env.VITE_APP_ID);
```

### 3. 测试 OAuth 服务器连接

```bash
# 测试后端 API 连接
curl -X POST http://192.168.1.141:8081/webdev.v1.WebDevAuthPublicService/ExchangeToken \
  -H "Content-Type: application/json" \
  -d '{"clientId":"test","grantType":"authorization_code","code":"test","redirectUri":"http://localhost:3000/api/oauth/callback"}'

# 测试前端门户连接
curl http://192.168.1.141:8081/portal/app-auth?appId=test&redirectUri=http://localhost:3000/api/oauth/callback
```

### 4. 查看 OAuth 流程日志

在浏览器开发者工具的 Network 标签中：
1. 查看登录重定向请求
2. 查看回调请求的参数
3. 检查后端 API 调用的响应

## 📚 相关文件

- `server/_core/env.ts` - 环境变量定义
- `server/_core/sdk.ts` - OAuth SDK 实现
- `server/_core/oauth.ts` - OAuth 路由处理
- `server/_core/types/manusTypes.ts` - OAuth API 类型定义
- `client/src/const.ts` - 前端登录 URL 生成
- `client/src/pages/Login.tsx` - 登录页面

## 🔗 相关文档

- [环境变量配置指南](./ENV_SETUP.md)
- [开发环境配置](./DEVELOPMENT.md)
