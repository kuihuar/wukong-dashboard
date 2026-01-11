# Wukong 虚拟机连接管理分析报告

## 📋 架构概述

项目采用**双后端架构**：

1. **Node.js 后端**（端口 3000）
   - 提供 tRPC API（`/api/trpc/*`）
   - 处理用户认证、项目管理、配额管理
   - 使用 Express + tRPC

2. **Go 后端**（端口 8081）
   - 提供 Kubernetes API 集成（`/api/vms/*`, `/api/snapshots/*`, `/api/ws`）
   - 直接连接 Kubernetes 集群管理 Wukong CRD
   - 使用 Gin + client-go

3. **前端**（React + TypeScript）
   - 通过 tRPC 调用 Node.js 后端
   - 直接通过 WebSocket/HTTP 调用 Go 后端（VNC 控制台）

## 🔍 连接流程分析

### 1. 虚拟机列表获取流程

**当前实现：**
```
前端 → tRPC (/api/trpc/vm.list) → Node.js 后端 → 返回 mockVMs
```

**问题：** Node.js 后端的 `server/routers.ts` 中，`vm.list` 路由返回的是模拟数据，没有真正调用 Go 后端。

**代码位置：**
```545:567:server/routers.ts
  vm: router({
    list: publicProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(({ input }) => {
        let vms = mockVMs;
        if (input?.projectId) {
          vms = mockVMs.filter(vm => vm.projectId === input.projectId);
        }
        return vms.map(vm => ({
          id: vm.id,
          name: vm.name,
          status: vm.status,
          cpu: vm.cpu,
          memory: vm.memory,
          nodeName: vm.nodeName,
          ipAddress: vm.networks[0]?.ipAddress || "",
          osImage: vm.osImage,
          createdAt: vm.createdAt,
          hasGpu: vm.gpus.length > 0,
          projectId: vm.projectId,
        }));
      }),
```

### 2. VNC 控制台连接流程

**当前实现：**
```
前端 → WebSocket (/api/vms/${vmName}/vnc) → ❌ 404 Not Found
```

**问题：** 
- VNCConsole 组件尝试连接 `/api/vms/${vmName}/vnc`
- 但 Node.js 服务器上没有这个路由
- Go 后端在 8081 端口提供此服务，但前端无法直接访问

**代码位置：**
```28:30:client/src/components/VNCConsole.tsx
    // Connect to VNC WebSocket proxy
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/vms/${vmName}/vnc`;
```

### 3. Go 后端 API 端点

**Go 后端提供的真实 API：**
```61:90:go-backend/cmd/server/main.go
	// API routes
	api := router.Group("/api")
	{
		// VM routes
		vms := api.Group("/vms")
		{
			vms.GET("", vmHandler.ListVMs)
			vms.GET("/stats", vmHandler.GetVMStats)
			vms.POST("", vmHandler.CreateVM)
			vms.GET("/:name", vmHandler.GetVM)
			vms.POST("/:name/action", vmHandler.VMAction)
			vms.GET("/:name/snapshots", snapshotHandler.ListSnapshotsByVM)

			// VNC routes
			vms.GET("/:name/vnc", vncProxy.HandleVNC)
			vms.GET("/:name/vnc/info", vncProxy.GetVNCInfo)
		}

		// Snapshot routes
		snapshots := api.Group("/snapshots")
		{
			snapshots.GET("", snapshotHandler.ListSnapshots)
			snapshots.POST("", snapshotHandler.CreateSnapshot)
			snapshots.POST("/:name/restore", snapshotHandler.RestoreSnapshot)
			snapshots.DELETE("/:name", snapshotHandler.DeleteSnapshot)
		}

		// WebSocket route for real-time updates
		api.GET("/ws", wsHandler.HandleWebSocket)
	}
```

## ❌ 发现的问题

### 问题 1：缺少 API 代理配置

**严重程度：** 🔴 严重

**描述：** Node.js 服务器没有将 `/api/vms/*`、`/api/snapshots/*` 和 `/api/ws` 请求代理到 Go 后端（8081 端口）。

**影响：**
- VNC 控制台无法连接
- 前端无法直接调用 Go 后端的真实 Kubernetes API
- WebSocket 实时更新无法工作

**当前状态：**
```1:65:server/_core/index.ts
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
```

**缺少的代码：** 没有代理中间件将请求转发到 `http://localhost:8081`

### 问题 2：tRPC 路由使用 Mock 数据

**严重程度：** 🟡 中等

**描述：** `server/routers.ts` 中的 VM 相关路由返回的是硬编码的 mock 数据，而不是调用 Go 后端。

**影响：**
- 前端显示的是假数据，不是真实的 Kubernetes 资源
- 无法看到真实的虚拟机状态
- 创建、删除等操作不会真正执行

### 问题 3：VNC 连接地址硬编码

**严重程度：** 🟡 中等

**描述：** VNCConsole 组件使用相对路径连接，假设 Node.js 服务器会代理请求。

**代码：**
```28:30:client/src/components/VNCConsole.tsx
    // Connect to VNC WebSocket proxy
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/vms/${vmName}/vnc`;
```

**问题：** 如果 Go 后端运行在不同的主机或端口，这个硬编码的 URL 会失败。

### 问题 4：缺少环境变量配置

**严重程度：** 🟡 中等

**描述：** 没有环境变量来配置 Go 后端的地址和端口。

**应该有的配置：**
- `GO_BACKEND_URL` 或 `KUBERNETES_API_URL`
- `GO_BACKEND_PORT`（默认 8081）

## 🔧 解决方案

### 方案 1：添加 HTTP 代理中间件（推荐）

在 Node.js 服务器中添加代理，将 Go 后端的 API 请求转发。

**优点：**
- 前端无需修改
- 统一入口，便于管理
- 可以添加认证、日志等中间件

**实现步骤：**
1. 安装 `http-proxy-middleware`
2. 在 `server/_core/index.ts` 中添加代理配置
3. 配置环境变量 `GO_BACKEND_URL`

### 方案 2：修改 tRPC 路由调用 Go 后端

修改 `server/routers.ts`，让 tRPC 路由通过 HTTP 调用 Go 后端。

**优点：**
- 保持 tRPC 的类型安全
- 统一使用 tRPC 接口

**缺点：**
- 需要处理 WebSocket 代理（VNC）
- 需要修改大量代码

### 方案 3：前端直接连接 Go 后端

修改前端代码，直接连接到 Go 后端（需要配置 CORS）。

**缺点：**
- 需要处理跨域问题
- 需要管理两个不同的 API 端点
- 不符合统一入口的最佳实践

## 📝 推荐修复步骤

### 步骤 1：安装代理中间件
```bash
pnpm add http-proxy-middleware
pnpm add -D @types/http-proxy-middleware
```

### 步骤 2：添加环境变量
在 `.env` 文件中添加：
```
GO_BACKEND_URL=http://localhost:8081
```

### 步骤 3：修改服务器配置
在 `server/_core/index.ts` 中添加代理中间件，将 `/api/vms/*`、`/api/snapshots/*`、`/api/ws` 代理到 Go 后端。

### 步骤 4：更新 tRPC 路由（可选）
如果需要，可以修改 `server/routers.ts` 中的 VM 路由，通过 HTTP 调用 Go 后端而不是返回 mock 数据。

## 🎯 总结

**核心问题：** Node.js 服务器缺少将请求代理到 Go 后端的配置，导致：
1. VNC 控制台无法连接
2. 前端无法访问真实的 Kubernetes API
3. WebSocket 实时更新无法工作

**优先级：** 🔴 高优先级 - 需要立即修复以启用核心功能

