# Wukong Dashboard - Node.js 後端和認證系統詳解

## 📋 概述

在 wukong-dashboard 倉庫中，包含了三個主要組件：

| 組件 | 位置 | 用途 | 技術棧 |
|------|------|------|--------|
| **前端** | `/client` | React UI 界面 | React 19 + TypeScript + Tailwind CSS |
| **Node.js 後端** | `/server` | API 服務 + 業務邏輯 | Express 4 + tRPC 11 + Drizzle ORM |
| **認證系統** | `/server/_core` | OAuth + JWT + MFA | Manus OAuth + JWT + TOTP |
| **Go 後端** | `/go-backend` | Kubernetes 集成 | Gin + client-go |

---

## 🔧 Node.js 後端詳解

### 位置
```
wukong-dashboard/server/
├── _core/                    # 核心框架層
│   ├── index.ts             # 服務器入口
│   ├── context.ts           # tRPC 上下文
│   ├── env.ts               # 環境變量管理
│   ├── oauth.ts             # OAuth 認證 ← 認證系統
│   ├── sdk.ts               # OAuth SDK
│   ├── mfa.ts               # MFA 服務 ← 認證系統
│   ├── sessionManager.ts    # 會話管理 ← 認證系統
│   ├── llm.ts               # LLM 集成
│   ├── notification.ts      # 通知服務
│   ├── voiceTranscription.ts # 語音轉文本
│   ├── imageGeneration.ts   # 圖像生成
│   └── map.ts               # 地圖服務
├── routers.ts               # tRPC 路由定義
├── db.ts                    # 數據庫操作
└── storage.ts               # S3 存儲操作
```

### Node.js 後端的職責

#### 1. **API 服務層** (Express + tRPC)
```typescript
// server/routers.ts - 定義所有 API 端點
export const appRouter = router({
  // 認證相關
  auth: router({
    me: protectedProcedure.query(...),
    logout: protectedProcedure.mutation(...),
  }),
  
  // 虛擬機管理
  vm: router({
    list: protectedProcedure.query(...),
    create: protectedProcedure.mutation(...),
    get: protectedProcedure.query(...),
    delete: protectedProcedure.mutation(...),
  }),
  
  // 項目管理
  project: router({
    list: protectedProcedure.query(...),
    create: protectedProcedure.mutation(...),
    getDefault: protectedProcedure.query(...),
  }),
  
  // 配額管理
  quota: router({
    list: protectedProcedure.query(...),
    check: protectedProcedure.mutation(...),
  }),
});
```

#### 2. **業務邏輯層** (db.ts)
```typescript
// server/db.ts - 數據庫操作和業務邏輯
export async function createVM(data: {
  projectId: number;
  name: string;
  cpu: number;
  memory: number;
}) {
  // 1. 檢查配額
  // 2. 創建 VM 記錄
  // 3. 調用 Go 後端
  // 4. 更新資源使用
  // 5. 記錄審計日誌
}

export async function getUserProjects(userId: number) {
  // 1. 查詢用戶所屬項目
  // 2. 返回項目列表
}
```

#### 3. **數據庫操作** (Drizzle ORM)
```typescript
// server/db.ts - 使用 Drizzle ORM 操作數據庫
const db = await getDb();
const users = await db.select().from(usersTable).where(...);
const projects = await db.insert(projectsTable).values(...);
```

#### 4. **存儲服務** (S3)
```typescript
// server/storage.ts - 文件上傳到 S3
export async function uploadFile(file: Buffer, fileName: string) {
  return await storagePut(`files/${fileName}`, file);
}
```

---

## 🔐 認證系統詳解

### 位置
```
wukong-dashboard/server/_core/
├── oauth.ts              # OAuth 認證流程
├── sdk.ts                # OAuth SDK 通信
├── mfa.ts                # 多因素認證 (TOTP)
├── sessionManager.ts     # 會話管理
└── context.ts            # tRPC 上下文 (用戶注入)
```

### 認證系統的組件

#### 1. **OAuth 認證** (oauth.ts)

**功能：** 處理 Manus OAuth 登錄流程

```typescript
// server/_core/oauth.ts
export async function handleOAuthCallback(code: string) {
  // 1. 交換授權碼獲取 Access Token
  const token = await exchangeAuthorizationCode(code);
  
  // 2. 獲取用戶信息
  const userInfo = await getUserInfo(token);
  
  // 3. 查詢或創建用戶
  let user = await getUserByOpenId(userInfo.openId);
  if (!user) {
    user = await createUser(userInfo);
    // 為新用戶創建默認項目
    await createDefaultProject(user.id);
  }
  
  // 4. 生成 JWT Token
  const jwtToken = generateJWT(user);
  
  // 5. 設置 Session Cookie
  setSessionCookie(jwtToken);
  
  // 6. 記錄審計日誌
  await logAuditEvent(user.id, 'login', userInfo.ipAddress);
  
  return user;
}
```

**流程圖：**
```
用戶點擊登錄
    ↓
重定向到 Manus OAuth
    ↓
用戶授權
    ↓
Manus 返回授權碼
    ↓
後端交換 Access Token
    ↓
獲取用戶信息
    ↓
查詢或創建用戶
    ↓
生成 JWT Token
    ↓
設置 Session Cookie
    ↓
重定向到儀表板
```

#### 2. **JWT 令牌管理** (context.ts)

**功能：** 驗證和管理 JWT 令牌

```typescript
// server/_core/context.ts
export async function createContext(req: Request, res: Response) {
  // 1. 從 Cookie 中提取 JWT Token
  const token = req.cookies.sessionToken;
  
  // 2. 驗證 JWT 簽名
  const decoded = verifyJWT(token);
  
  // 3. 查詢用戶信息
  const user = await getUserById(decoded.userId);
  
  // 4. 返回上下文
  return { user, req, res };
}

// 在 tRPC 路由中使用
export const protectedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx });
});
```

#### 3. **多因素認證** (mfa.ts)

**功能：** TOTP 和備份碼管理

```typescript
// server/_core/mfa.ts
export async function setupMFA(userId: number) {
  // 1. 生成 TOTP 密鑰
  const secret = generateSecret();
  
  // 2. 生成 QR 碼
  const qrCode = generateQRCode(secret);
  
  // 3. 生成備份碼
  const backupCodes = generateBackupCodes();
  
  // 4. 保存到數據庫
  await saveMFASettings(userId, { secret, backupCodes });
  
  return { qrCode, backupCodes };
}

export async function verifyMFA(userId: number, code: string) {
  // 1. 獲取用戶 MFA 設置
  const mfaSettings = await getMFASettings(userId);
  
  // 2. 驗證 TOTP 碼
  const isValid = verifyTOTP(code, mfaSettings.secret);
  
  // 3. 或驗證備份碼
  if (!isValid) {
    const isBackupValid = verifyBackupCode(code, mfaSettings.backupCodes);
    if (isBackupValid) {
      // 標記備份碼已使用
      await markBackupCodeUsed(userId, code);
      return true;
    }
  }
  
  return isValid;
}
```

#### 4. **會話管理** (sessionManager.ts)

**功能：** 設備追蹤和遠程登出

```typescript
// server/_core/sessionManager.ts
export async function createSession(userId: number, options: {
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  // 1. 生成安全的 Session Token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  
  // 2. 解析用戶代理
  const { browser, os } = getDeviceInfo(options.userAgent);
  
  // 3. 保存會話到數據庫
  await saveSession(userId, {
    sessionToken,
    deviceName: options.deviceName || `${browser} on ${os}`,
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 天
  });
  
  return sessionToken;
}

export async function revokeAllSessions(userId: number) {
  // 遠程登出：撤銷用戶的所有會話
  await invalidateAllUserSessions(userId);
  
  // 記錄審計日誌
  await logAuditEvent(userId, 'all_sessions_revoked', 'Remote logout');
}
```

#### 5. **OIDC 企業認證** (oidc.ts - 待實現)

**功能：** 支持企業身份提供商（Azure AD、Google Workspace 等）

```typescript
// server/_core/oidc.ts (規劃中)
export async function handleOIDCCallback(code: string, provider: string) {
  // 1. 根據提供商配置交換令牌
  const token = await exchangeOIDCToken(code, provider);
  
  // 2. 獲取用戶信息
  const userInfo = await getOIDCUserInfo(token, provider);
  
  // 3. 查詢或創建用戶
  let user = await getUserByOIDCIdentity(provider, userInfo.sub);
  if (!user) {
    user = await createUserFromOIDC(userInfo, provider);
  }
  
  // 4. 生成 JWT Token
  const jwtToken = generateJWT(user);
  
  return jwtToken;
}
```

---

## 📊 認證系統架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (React)                            │
│  - 登錄頁面                                                  │
│  - useAuth() Hook                                            │
│  - 受保護路由                                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                    HTTP 請求
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌──────────────────┐          ┌──────────────────────┐
│  OAuth 回調      │          │  API 請求            │
│  /api/oauth/     │          │  /api/trpc/*         │
│  callback        │          │                      │
└────────┬─────────┘          └──────────┬───────────┘
         │                               │
         ▼                               ▼
    ┌────────────────────────────────────────────┐
    │     Express 服務器                         │
    │     server/_core/index.ts                  │
    └────────────────────────────────────────────┘
         │
    ┌────┴─────────────────────────────────────┐
    │                                           │
    ▼                                           ▼
┌─────────────────────┐          ┌──────────────────────┐
│  OAuth 認證         │          │  tRPC 路由           │
│  oauth.ts           │          │  routers.ts          │
│                     │          │                      │
│ 1. 交換授權碼      │          │ 1. 驗證 JWT          │
│ 2. 獲取用戶信息    │          │ 2. 檢查權限          │
│ 3. 創建/更新用戶   │          │ 3. 執行業務邏輯      │
│ 4. 生成 JWT        │          │ 4. 返回結果          │
│ 5. 設置 Cookie     │          │                      │
└────────┬────────────┘          └──────────┬───────────┘
         │                                   │
         └───────────────┬───────────────────┘
                         │
                    ┌────▼──────────────┐
                    │  上下文管理       │
                    │  context.ts       │
                    │                   │
                    │ - 驗證 JWT        │
                    │ - 注入用戶信息    │
                    │ - 檢查權限        │
                    └────┬──────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌────────┐      ┌──────────┐
    │  MFA   │      │ 會話   │      │ 審計日誌 │
    │ mfa.ts │      │ 管理   │      │ db.ts    │
    │        │      │ session│      │          │
    │ TOTP   │      │Manager │      │ 記錄所有 │
    │ 備份碼 │      │        │      │ 安全事件 │
    │        │      │ 設備   │      │          │
    │        │      │ 追蹤   │      │          │
    │        │      │ 遠程   │      │          │
    │        │      │ 登出   │      │          │
    └────────┘      └────────┘      └──────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                    ┌────▼──────────────┐
                    │  數據庫操作       │
                    │  db.ts            │
                    │                   │
                    │ - 用戶表          │
                    │ - MFA 設置表      │
                    │ - 會話表          │
                    │ - 審計日誌表      │
                    │ - OIDC 身份表     │
                    └────┬──────────────┘
                         │
                    ┌────▼──────────────┐
                    │  MySQL/TiDB       │
                    │  數據庫           │
                    └───────────────────┘
```

---

## 🔄 認證流程詳解

### 1. 用戶登錄流程

```
步驟 1: 用戶訪問應用
  前端檢查 localStorage 中的 JWT Token
  ↓
步驟 2: Token 有效？
  是 → 加載儀表板
  否 → 重定向到登錄頁面
  ↓
步驟 3: 用戶點擊登錄
  前端重定向到 Manus OAuth
  ↓
步驟 4: 用戶授權
  Manus OAuth 返回授權碼
  ↓
步驟 5: 後端處理回調
  POST /api/oauth/callback?code=xxx
  ↓
步驟 6: 交換授權碼
  oauth.ts 調用 SDK 交換 Access Token
  ↓
步驟 7: 獲取用戶信息
  oauth.ts 使用 Access Token 獲取用戶信息
  ↓
步驟 8: 查詢或創建用戶
  db.ts 檢查用戶是否存在
  如果不存在，創建新用戶和默認項目
  ↓
步驟 9: 生成 JWT Token
  oauth.ts 生成 JWT Token (包含 userId、role 等)
  ↓
步驟 10: 設置 Session Cookie
  oauth.ts 設置 httpOnly Cookie
  ↓
步驟 11: 創建會話記錄
  sessionManager.ts 記錄設備信息
  ↓
步驟 12: 記錄審計日誌
  db.ts 記錄登錄事件
  ↓
步驟 13: 重定向到儀表板
  前端存儲 JWT Token 到 localStorage
  加載儀表板
```

### 2. API 請求認證流程

```
步驟 1: 前端調用 API
  const { data } = trpc.vm.list.useQuery()
  ↓
步驟 2: tRPC 添加 JWT Token
  自動從 Cookie 或 localStorage 獲取 Token
  ↓
步驟 3: 後端接收請求
  Express 中間件提取 Token
  ↓
步驟 4: 驗證 JWT
  context.ts 驗證 JWT 簽名
  ↓
步驟 5: 驗證失敗？
  是 → 返回 401 Unauthorized
  否 → 繼續
  ↓
步驟 6: 查詢用戶信息
  context.ts 從 JWT 中提取 userId
  db.ts 查詢用戶信息
  ↓
步驟 7: 檢查權限
  routers.ts 中的 protectedProcedure 檢查用戶是否存在
  ↓
步驟 8: 檢查業務權限
  例如：檢查用戶是否屬於該項目
  ↓
步驟 9: 執行業務邏輯
  db.ts 執行相應操作
  ↓
步驟 10: 返回結果
  tRPC 返回結果給前端
```

### 3. MFA 驗證流程

```
步驟 1: 用戶啟用 MFA
  前端調用 auth.mfa.setup
  ↓
步驟 2: 生成 TOTP 密鑰
  mfa.ts 生成 32 字符密鑰
  ↓
步驟 3: 生成 QR 碼
  mfa.ts 使用 qrcode 庫生成 QR 碼
  ↓
步驟 4: 生成備份碼
  mfa.ts 生成 10 個備份碼
  ↓
步驟 5: 用戶掃描 QR 碼
  用戶在認證器應用中掃描 QR 碼
  ↓
步驟 6: 用戶輸入 TOTP 碼
  前端提示用戶輸入 6 位碼
  ↓
步驟 7: 驗證 TOTP 碼
  mfa.ts 驗證碼是否正確
  ↓
步驟 8: 保存 MFA 設置
  db.ts 保存密鑰和備份碼到數據庫
  ↓
步驟 9: 登錄時驗證 MFA
  用戶登錄後，提示輸入 TOTP 碼
  mfa.ts 驗證碼
  ↓
步驟 10: 備份碼使用
  如果用戶丟失認證器，可使用備份碼
  mfa.ts 驗證備份碼並標記為已使用
```

---

## 📂 文件對應表

| 功能 | Node.js 後端 | 認證系統 | 前端 |
|------|-------------|--------|------|
| 用戶登錄 | routers.ts | oauth.ts | useAuth.ts |
| JWT 驗證 | context.ts | context.ts | useAuth.ts |
| 權限檢查 | routers.ts | context.ts | useAuth.ts |
| MFA 設置 | routers.ts | mfa.ts | (待實現) |
| 會話管理 | routers.ts | sessionManager.ts | (待實現) |
| 審計日誌 | db.ts | db.ts | (待實現) |
| OIDC 認證 | routers.ts | oidc.ts | (待實現) |

---

## 🔗 代碼引用

### 認證相關路由 (server/routers.ts)
```typescript
export const appRouter = router({
  auth: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      return ctx.user;
    }),
    
    logout: protectedProcedure.mutation(async ({ ctx }) => {
      // 清除 Session Cookie
      ctx.res.clearCookie('sessionToken');
      return { success: true };
    }),
  }),
});
```

### 用戶信息注入 (server/_core/context.ts)
```typescript
export async function createContext(req: Request, res: Response) {
  const token = req.cookies.sessionToken;
  
  if (!token) {
    return { user: null, req, res };
  }
  
  try {
    const decoded = verifyJWT(token);
    const user = await db.select().from(usersTable)
      .where(eq(usersTable.id, decoded.userId));
    
    return { user: user[0] || null, req, res };
  } catch (error) {
    return { user: null, req, res };
  }
}
```

### 前端認證 Hook (client/src/_core/hooks/useAuth.ts)
```typescript
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const { data } = trpc.auth.me.useQuery();
  
  useEffect(() => {
    if (data) {
      setUser(data);
    }
    setLoading(false);
  }, [data]);
  
  const logout = async () => {
    await trpc.auth.logout.mutate();
    setUser(null);
    window.location.href = '/';
  };
  
  return { user, loading, logout };
}
```

---

## 🎯 總結

### Node.js 後端 (/server)
- **職責：** 提供 API 服務、業務邏輯、數據庫操作
- **技術：** Express + tRPC + Drizzle ORM
- **文件：** routers.ts (路由)、db.ts (業務邏輯)、storage.ts (存儲)

### 認證系統 (/server/_core)
- **職責：** 用戶認證、授權、會話管理、安全
- **技術：** OAuth 2.0、JWT、TOTP、會話管理
- **文件：** oauth.ts、context.ts、mfa.ts、sessionManager.ts

### 前端 (/client)
- **職責：** UI 界面、用戶交互
- **技術：** React 19 + TypeScript + Tailwind CSS
- **文件：** useAuth.ts (認證 Hook)、pages/* (頁面)

---

**最後更新：** 2026年1月11日
