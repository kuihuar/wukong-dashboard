# 开发环境认证禁用说明

## ✅ 已完成的修改

已在开发环境中临时禁用认证，允许在没有 OAuth 服务器的情况下进行开发。

## 🔧 修改内容

### 1. `server/_core/context.ts`
- 在开发环境中，如果认证失败，自动创建并使用 mock 用户
- Mock 用户信息：
  - `openId`: `"dev-user-mock"`
  - `name`: `"Development User"`
  - `email`: `"dev@localhost"`
  - `role`: `"admin"` (管理员权限)

### 2. `server/_core/trpc.ts`
- `protectedProcedure` 在开发环境中允许无用户请求
- `adminProcedure` 在开发环境中允许非管理员访问

## 🎯 工作原理

### 开发环境（`NODE_ENV !== "production"`）

1. **认证流程**：
   - 尝试正常认证（从 cookie 获取 session）
   - 如果失败，自动创建/获取 mock 用户
   - 所有请求都会有一个用户对象（即使是 mock 用户）

2. **权限检查**：
   - `protectedProcedure`：允许通过（即使没有真实认证）
   - `adminProcedure`：允许通过（mock 用户是 admin 角色）

### 生产环境（`NODE_ENV === "production"`）

- 严格要求认证
- 没有 session cookie 会抛出 `UNAUTHORIZED` 错误
- 权限检查正常工作

## 📝 使用说明

### 启动开发服务器

```bash
# 确保 NODE_ENV=development
NODE_ENV=development pnpm dev
```

### Mock 用户自动创建

首次请求时，系统会自动在数据库中创建 mock 用户：
- 如果数据库连接正常，mock 用户会被保存到数据库
- 如果数据库不可用，会输出警告但不会阻止请求

### 查看当前用户

访问任何需要认证的 API，都会自动使用 mock 用户：

```typescript
// 在 tRPC 路由中
protectedProcedure.query(async ({ ctx }) => {
  console.log(ctx.user); // { openId: "dev-user-mock", name: "Development User", role: "admin" }
});
```

## ⚠️ 注意事项

1. **仅限开发环境**：此功能只在 `NODE_ENV !== "production"` 时生效
2. **数据库依赖**：Mock 用户需要数据库连接才能创建，如果数据库不可用，会输出警告
3. **安全警告**：不要在生产环境中使用此配置

## 🔄 恢复认证

如果需要恢复正常的认证流程：

1. 确保 OAuth 服务器运行
2. 设置 `NODE_ENV=production`
3. 或者注释掉 `context.ts` 中的 mock 用户逻辑

## 📊 日志输出

开发环境中会看到以下日志：

```
[Auth] Development mode: Using mock user
[Auth] Development mode: Allowing request without authentication
```

这些是正常的开发模式日志，可以忽略。

---

**最后更新：** 2026-01-11

