import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("vm.list", () => {
  it("returns a list of virtual machines", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vm.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    
    // Verify VM structure
    const vm = result[0];
    expect(vm).toHaveProperty("id");
    expect(vm).toHaveProperty("name");
    expect(vm).toHaveProperty("status");
    expect(vm).toHaveProperty("cpu");
    expect(vm).toHaveProperty("memory");
  });
});

describe("vm.get", () => {
  it("returns a specific virtual machine by id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vm.get({ id: "wukong-ubuntu-01" });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("wukong-ubuntu-01");
    expect(result?.name).toBe("ubuntu-web-server");
    expect(result?.status).toBe("Running");
    expect(result?.metrics).toHaveProperty("cpuUsage");
    expect(result?.metrics).toHaveProperty("memoryUsage");
    expect(result?.metricsHistory).toHaveProperty("cpu");
    expect(result?.metricsHistory).toHaveProperty("memory");
  });

  it("returns null for non-existent VM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vm.get({ id: "non-existent-vm" });

    expect(result).toBeNull();
  });
});

describe("vm.create", () => {
  it("creates a new virtual machine", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vm.create({
      name: "test-vm",
      cpu: 2,
      memory: "4Gi",
      osImage: "ubuntu:22.04",
      disks: [
        { name: "rootdisk", size: "80Gi", storageClassName: "longhorn", boot: true }
      ],
      networks: [
        { name: "default", type: "pod", mode: "dhcp" }
      ],
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("test-vm");
  });
});

describe("vm.action", () => {
  it("performs start action on a stopped VM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Use the stopped VM ID
    const result = await caller.vm.action({ id: "wukong-dev-04", action: "start" });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Starting");
  });

  it("performs stop action on a running VM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vm.action({ id: "wukong-ubuntu-01", action: "stop" });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Stopping");
  });

  it("performs restart action on a VM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vm.action({ id: "wukong-ubuntu-01", action: "restart" });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Restarting");
  });

  it("performs delete action on a VM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vm.action({ id: "wukong-ubuntu-01", action: "delete" });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Deleting");
  });

  it("returns failure for non-existent VM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vm.action({ id: "non-existent", action: "start" });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});

describe("vm.stats", () => {
  it("returns VM statistics", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vm.stats();

    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("running");
    expect(result).toHaveProperty("stopped");
    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("pending");
    expect(result).toHaveProperty("totalCpu");
    expect(result).toHaveProperty("totalMemory");
    expect(result.total).toBeGreaterThan(0);
  });
});

describe("snapshot.list", () => {
  it("returns a list of all snapshots", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.snapshot.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    
    const snapshot = result[0];
    expect(snapshot).toHaveProperty("id");
    expect(snapshot).toHaveProperty("name");
    expect(snapshot).toHaveProperty("wukongId");
    expect(snapshot).toHaveProperty("wukongName");
    expect(snapshot).toHaveProperty("status");
    expect(snapshot).toHaveProperty("size");
    expect(snapshot).toHaveProperty("createdAt");
  });
});

describe("snapshot.listByVM", () => {
  it("returns snapshots for a specific VM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.snapshot.listByVM({ vmId: "wukong-ubuntu-01" });

    expect(Array.isArray(result)).toBe(true);
    result.forEach(snapshot => {
      expect(snapshot.wukongId).toBe("wukong-ubuntu-01");
    });
  });
});

describe("snapshot.create", () => {
  it("creates a new snapshot for existing VM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.snapshot.create({
      wukongId: "wukong-ubuntu-01",
      name: "test-snapshot",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("test-snapshot");
  });

  it("returns failure for non-existent VM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.snapshot.create({
      wukongId: "non-existent",
      name: "test-snapshot",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});

describe("snapshot.restore", () => {
  it("restores from an existing snapshot", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.snapshot.restore({ snapshotId: "snapshot-001" });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Restoring");
  });

  it("returns failure for non-existent snapshot", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.snapshot.restore({ snapshotId: "non-existent" });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});

describe("snapshot.delete", () => {
  it("deletes an existing snapshot", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.snapshot.delete({ snapshotId: "snapshot-001" });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Deleting");
  });

  it("returns failure for non-existent snapshot", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.snapshot.delete({ snapshotId: "non-existent" });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});
