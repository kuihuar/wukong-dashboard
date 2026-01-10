import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => ({
  getQuotaAndUsage: vi.fn().mockResolvedValue({
    quota: {
      id: 1,
      projectId: 1,
      maxVMs: 10,
      maxCPU: 32,
      maxMemoryGB: 128,
      maxStorageGB: 1000,
      maxSnapshots: 20,
      maxGPUs: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    usage: {
      usedVMs: 3,
      usedCPU: 12,
      usedMemoryGB: 32,
      usedStorageGB: 300,
      usedSnapshots: 5,
      usedGPUs: 1,
    },
  }),
  checkQuotaForVM: vi.fn().mockImplementation((projectId, cpu, memoryGB, storageGB, gpus) => {
    // Simulate quota check logic
    const maxCPU = 32;
    const maxMemoryGB = 128;
    const maxStorageGB = 1000;
    const maxGPUs = 4;
    const usedCPU = 12;
    const usedMemoryGB = 32;
    const usedStorageGB = 300;
    const usedGPUs = 1;

    if (usedCPU + cpu > maxCPU) {
      return { allowed: false, reason: `CPU quota exceeded: requesting ${cpu}, available ${maxCPU - usedCPU}` };
    }
    if (usedMemoryGB + memoryGB > maxMemoryGB) {
      return { allowed: false, reason: `Memory quota exceeded: requesting ${memoryGB}GB, available ${maxMemoryGB - usedMemoryGB}GB` };
    }
    if (usedStorageGB + storageGB > maxStorageGB) {
      return { allowed: false, reason: `Storage quota exceeded: requesting ${storageGB}GB, available ${maxStorageGB - usedStorageGB}GB` };
    }
    if (usedGPUs + gpus > maxGPUs) {
      return { allowed: false, reason: `GPU quota exceeded: requesting ${gpus}, available ${maxGPUs - usedGPUs}` };
    }
    return { allowed: true, reason: null };
  }),
  checkQuotaForSnapshot: vi.fn().mockResolvedValue({
    allowed: true,
    reason: null,
  }),
  getAllProjects: vi.fn().mockResolvedValue([
    { id: 1, name: "default", description: "Default project", createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "ml-team", description: "Machine Learning Team", createdAt: new Date(), updatedAt: new Date() },
  ]),
  getAllQuotaTemplates: vi.fn().mockResolvedValue([
    { id: 1, name: "small", maxVMs: 5, maxCPU: 16, maxMemoryGB: 64, maxStorageGB: 500, maxSnapshots: 10, maxGPUs: 1, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "medium", maxVMs: 10, maxCPU: 32, maxMemoryGB: 128, maxStorageGB: 1000, maxSnapshots: 20, maxGPUs: 4, createdAt: new Date(), updatedAt: new Date() },
  ]),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getDb: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("quota.get", () => {
  it("returns quota and usage for a project", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.quota.get({ projectId: 1 });

    expect(result.quota).toBeDefined();
    expect(result.quota?.maxVMs).toBe(10);
    expect(result.quota?.maxCPU).toBe(32);
    expect(result.usage).toBeDefined();
    expect(result.usage?.usedVMs).toBe(3);
  });
});

describe("quota.check", () => {
  it("allows VM creation within quota limits", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.quota.check({
      projectId: 1,
      cpu: 4,
      memoryGB: 8,
      storageGB: 100,
      gpus: 0,
    });

    expect(result.allowed).toBe(true);
  });

  it("rejects VM creation when CPU quota exceeded", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.quota.check({
      projectId: 1,
      cpu: 30, // Would exceed 32 - 12 = 20 available
      memoryGB: 8,
      storageGB: 100,
      gpus: 0,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("CPU quota exceeded");
  });

  it("rejects VM creation when memory quota exceeded", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.quota.check({
      projectId: 1,
      cpu: 4,
      memoryGB: 100, // Would exceed 128 - 32 = 96 available
      storageGB: 100,
      gpus: 0,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Memory quota exceeded");
  });

  it("rejects VM creation when GPU quota exceeded", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.quota.check({
      projectId: 1,
      cpu: 4,
      memoryGB: 8,
      storageGB: 100,
      gpus: 5, // Would exceed 4 - 1 = 3 available
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("GPU quota exceeded");
  });
});

describe("quota.checkSnapshot", () => {
  it("allows snapshot creation within quota limits", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.quota.checkSnapshot({ projectId: 1 });

    expect(result.allowed).toBe(true);
  });
});

describe("project.list", () => {
  it("returns all projects", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.list();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("default");
    expect(result[1].name).toBe("ml-team");
  });
});

describe("quotaTemplate.list", () => {
  it("returns all quota templates", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.quotaTemplate.list();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("small");
    expect(result[1].name).toBe("medium");
  });
});
