import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { Options } from "http-proxy-middleware";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

// Load environment variables
// Priority: .env.local > .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// Load .env.local first (higher priority)
const envLocalPath = path.resolve(projectRoot, ".env.local");
const envLocalResult = dotenv.config({ path: envLocalPath });
if (envLocalResult.error && process.env.NODE_ENV === "development") {
  console.log(`[Env] .env.local not found at ${envLocalPath}, skipping...`);
} else if (!envLocalResult.error && process.env.NODE_ENV === "development") {
  console.log(`[Env] Loaded .env.local from ${envLocalPath}`);
}

// Then load .env (lower priority, won't override .env.local)
const envPath = path.resolve(projectRoot, ".env");
const envResult = dotenv.config({ path: envPath });
if (!envResult.error && process.env.NODE_ENV === "development") {
  console.log(`[Env] Loaded .env from ${envPath}`);
}

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
  
  // Proxy to Go backend for Kubernetes API
  const goBackendUrl = process.env.GO_BACKEND_URL || "http://localhost:8081";
  console.log(`Proxying Go backend requests to: ${goBackendUrl}`);
  
  // Proxy /api/vms/* to Go backend
  const vmsProxyOptions = {
    target: goBackendUrl,
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying for VNC
    onProxyReq: (_proxyReq: unknown, req: Request) => {
      if (process.env.NODE_ENV === "development") {
        console.log(`[Proxy] ${req.method} ${req.url} -> ${goBackendUrl}${req.url}`);
      }
    },
    onError: (err: Error, req: Request, res: Response) => {
      console.error(`[Proxy Error] ${req.url}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Failed to connect to Go backend",
          message: err.message,
        });
      }
    },
  } as Options;
  app.use("/api/vms", createProxyMiddleware(vmsProxyOptions));
  
  // Proxy /api/snapshots/* to Go backend
  const snapshotsProxyOptions = {
    target: goBackendUrl,
    changeOrigin: true,
    onProxyReq: (_proxyReq: unknown, req: Request) => {
      if (process.env.NODE_ENV === "development") {
        console.log(`[Proxy] ${req.method} ${req.url} -> ${goBackendUrl}${req.url}`);
      }
    },
    onError: (err: Error, req: Request, res: Response) => {
      console.error(`[Proxy Error] ${req.url}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Failed to connect to Go backend",
          message: err.message,
        });
      }
    },
  } as Options;
  app.use("/api/snapshots", createProxyMiddleware(snapshotsProxyOptions));
  
  // Proxy /api/ws WebSocket to Go backend for real-time updates
  const wsProxyOptions = {
    target: goBackendUrl,
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying
    onProxyReq: (_proxyReq: unknown, req: Request) => {
      if (process.env.NODE_ENV === "development") {
        console.log(`[Proxy WS] ${req.url} -> ${goBackendUrl}${req.url}`);
      }
    },
    onError: (err: Error, req: Request, res: Response) => {
      console.error(`[Proxy WS Error] ${req.url}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Failed to connect to Go backend WebSocket",
          message: err.message,
        });
      }
    },
  } as Options;
  app.use("/api/ws", createProxyMiddleware(wsProxyOptions));
  
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
