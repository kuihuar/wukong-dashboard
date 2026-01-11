# 代理中间件配置完成 ✅

## 📋 已完成的配置

### 1. 安装依赖
- ✅ 已安装 `http-proxy-middleware`
- ✅ 已安装类型定义（虽然包自带类型，但已添加）

### 2. 服务器配置
- ✅ 在 `server/_core/index.ts` 中添加了代理中间件
- ✅ 配置了以下路由的代理：
  - `/api/vms/*` → Go 后端（支持 WebSocket，用于 VNC）
  - `/api/snapshots/*` → Go 后端
  - `/api/ws` → Go 后端（WebSocket 实时更新）

### 3. 环境变量配置
- ✅ 添加了 `GO_BACKEND_URL` 环境变量支持
- ✅ 默认值：`http://localhost:8081`
- ✅ 更新了 `ENV_SETUP.md` 文档

## 🚀 使用方法

### 1. 配置环境变量

在 `.env.local` 文件中添加：

```env
# Go 后端 URL（如果使用默认端口 8081，可以省略）
GO_BACKEND_URL="http://localhost:8081"
```

### 2. 启动服务

**启动 Node.js 后端：**
```bash
pnpm dev
```

**启动 Go 后端（在另一个终端）：**
```bash
cd go-backend
go run cmd/server/main.go
# 或
PORT=8081 NAMESPACE=default go run cmd/server/main.go
```

### 3. 验证代理

**测试健康检查：**
```bash
curl http://localhost:3000/api/vms
# 应该返回 Go 后端的响应
```

**测试 VNC 信息：**
```bash
curl http://localhost:3000/api/vms/test-vm/vnc/info
```

## 📝 代理配置详情

### 代理的路由

| 前端路径 | 代理到 | 说明 |
|---------|--------|------|
| `/api/vms/*` | `{GO_BACKEND_URL}/api/vms/*` | 虚拟机管理 API，支持 WebSocket |
| `/api/snapshots/*` | `{GO_BACKEND_URL}/api/snapshots/*` | 快照管理 API |
| `/api/ws` | `{GO_BACKEND_URL}/api/ws` | WebSocket 实时更新 |

### 特性

- ✅ **WebSocket 支持**：VNC 控制台和实时更新都支持 WebSocket 代理
- ✅ **错误处理**：连接失败时返回友好的错误信息
- ✅ **开发模式日志**：开发环境下会打印详细的代理日志
- ✅ **自动重试**：代理中间件会自动处理连接问题

## 🔍 故障排查

### 问题 1：代理返回 502 错误

**原因：** Go 后端未运行或 URL 配置错误

**解决：**
```bash
# 1. 检查 Go 后端是否运行
curl http://localhost:8081/health

# 2. 检查环境变量
echo $GO_BACKEND_URL

# 3. 确保 Go 后端在正确的端口运行
```

### 问题 2：VNC 连接失败

**原因：** WebSocket 代理配置问题

**解决：**
- 确保代理配置中 `ws: true` 已启用
- 检查浏览器控制台的 WebSocket 连接错误
- 验证 Go 后端的 VNC 端点是否正常工作

### 问题 3：开发环境看不到代理日志

**原因：** `NODE_ENV` 未设置为 `development`

**解决：**
```bash
NODE_ENV=development pnpm dev
```

## 📚 相关文档

- [环境变量配置](./ENV_SETUP.md)
- [Wukong 虚拟机连接分析](./WUKONG_VM_CONNECTION_ANALYSIS.md)
- [Go 后端 README](./go-backend/README.md)

## ✅ 下一步

现在代理已配置完成，你可以：

1. **测试 VNC 控制台**：在虚拟机详情页打开 VNC 控制台
2. **测试实时更新**：使用 WebSocket 连接查看实时状态
3. **集成真实数据**：修改 tRPC 路由调用 Go 后端 API（可选）

---

**配置完成时间：** 2026-01-10

