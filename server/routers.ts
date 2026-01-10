import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

// Mock data for virtual machines
const mockVMs = [
  {
    id: "wukong-ubuntu-01",
    name: "ubuntu-web-server",
    status: "Running" as const,
    cpu: 4,
    memory: "8Gi",
    nodeName: "node-01",
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    networks: [
      { name: "default", interface: "eth0", ipAddress: "10.244.1.15", macAddress: "52:54:00:12:34:56" },
      { name: "external", interface: "eth1", ipAddress: "192.168.1.100", macAddress: "52:54:00:12:34:57" }
    ],
    disks: [
      { name: "rootdisk", size: "80Gi", storageClassName: "longhorn", boot: true, image: "ubuntu:22.04" },
      { name: "datadisk", size: "200Gi", storageClassName: "longhorn", boot: false }
    ],
    gpus: [],
    osImage: "Ubuntu 22.04 LTS",
    metrics: { cpuUsage: 45, memoryUsage: 62, diskUsage: 35 }
  },
  {
    id: "wukong-centos-02",
    name: "centos-db-server",
    status: "Running" as const,
    cpu: 8,
    memory: "16Gi",
    nodeName: "node-02",
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    networks: [
      { name: "default", interface: "eth0", ipAddress: "10.244.2.20", macAddress: "52:54:00:22:34:56" },
      { name: "management", interface: "eth1", ipAddress: "192.168.2.50", macAddress: "52:54:00:22:34:57" }
    ],
    disks: [
      { name: "rootdisk", size: "100Gi", storageClassName: "longhorn", boot: true, image: "centos:8" },
      { name: "dbdisk", size: "500Gi", storageClassName: "longhorn-ssd", boot: false }
    ],
    gpus: [],
    osImage: "CentOS 8 Stream",
    metrics: { cpuUsage: 72, memoryUsage: 85, diskUsage: 48 }
  },
  {
    id: "wukong-ml-03",
    name: "ml-training-node",
    status: "Running" as const,
    cpu: 16,
    memory: "64Gi",
    nodeName: "gpu-node-01",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    networks: [
      { name: "default", interface: "eth0", ipAddress: "10.244.3.30", macAddress: "52:54:00:32:34:56" }
    ],
    disks: [
      { name: "rootdisk", size: "200Gi", storageClassName: "longhorn-ssd", boot: true, image: "nvidia/cuda:12.0" }
    ],
    gpus: [{ name: "gpu-0", deviceName: "nvidia.com/gpu" }],
    osImage: "Ubuntu 22.04 + CUDA 12.0",
    metrics: { cpuUsage: 88, memoryUsage: 76, diskUsage: 22 }
  },
  {
    id: "wukong-dev-04",
    name: "dev-environment",
    status: "Stopped" as const,
    cpu: 2,
    memory: "4Gi",
    nodeName: "node-01",
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    networks: [
      { name: "default", interface: "eth0", ipAddress: "10.244.1.40", macAddress: "52:54:00:42:34:56" }
    ],
    disks: [
      { name: "rootdisk", size: "50Gi", storageClassName: "longhorn", boot: true, image: "debian:11" }
    ],
    gpus: [],
    osImage: "Debian 11",
    metrics: { cpuUsage: 0, memoryUsage: 0, diskUsage: 15 }
  },
  {
    id: "wukong-test-05",
    name: "test-server",
    status: "Error" as const,
    cpu: 4,
    memory: "8Gi",
    nodeName: "node-03",
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    networks: [
      { name: "default", interface: "eth0", ipAddress: "", macAddress: "52:54:00:52:34:56" }
    ],
    disks: [
      { name: "rootdisk", size: "80Gi", storageClassName: "longhorn", boot: true, image: "ubuntu:20.04" }
    ],
    gpus: [],
    osImage: "Ubuntu 20.04 LTS",
    metrics: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0 }
  },
  {
    id: "wukong-pending-06",
    name: "new-instance",
    status: "Pending" as const,
    cpu: 4,
    memory: "8Gi",
    nodeName: "",
    createdAt: Date.now() - 10 * 60 * 1000,
    networks: [
      { name: "default", interface: "eth0", ipAddress: "", macAddress: "" }
    ],
    disks: [
      { name: "rootdisk", size: "80Gi", storageClassName: "longhorn", boot: true, image: "ubuntu:22.04" }
    ],
    gpus: [],
    osImage: "Ubuntu 22.04 LTS",
    metrics: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0 }
  }
];

// Mock data for snapshots
const mockSnapshots = [
  {
    id: "snapshot-001",
    name: "ubuntu-web-backup-daily",
    wukongName: "ubuntu-web-server",
    wukongId: "wukong-ubuntu-01",
    status: "Succeeded" as const,
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    size: "45Gi"
  },
  {
    id: "snapshot-002",
    name: "centos-db-before-upgrade",
    wukongName: "centos-db-server",
    wukongId: "wukong-centos-02",
    status: "Succeeded" as const,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    size: "120Gi"
  },
  {
    id: "snapshot-003",
    name: "ml-training-checkpoint",
    wukongName: "ml-training-node",
    wukongId: "wukong-ml-03",
    status: "Creating" as const,
    createdAt: Date.now() - 30 * 60 * 1000,
    size: "0Gi"
  },
  {
    id: "snapshot-004",
    name: "dev-env-weekly",
    wukongName: "dev-environment",
    wukongId: "wukong-dev-04",
    status: "Succeeded" as const,
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    size: "25Gi"
  }
];

// Generate mock metrics history
function generateMetricsHistory(baseValue: number, points: number = 24) {
  const history = [];
  for (let i = points - 1; i >= 0; i--) {
    const timestamp = Date.now() - i * 60 * 60 * 1000;
    const variation = (Math.random() - 0.5) * 20;
    const value = Math.max(0, Math.min(100, baseValue + variation));
    history.push({ timestamp, value: Math.round(value) });
  }
  return history;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  vm: router({
    list: publicProcedure.query(() => {
      return mockVMs.map(vm => ({
        id: vm.id,
        name: vm.name,
        status: vm.status,
        cpu: vm.cpu,
        memory: vm.memory,
        nodeName: vm.nodeName,
        ipAddress: vm.networks[0]?.ipAddress || "",
        osImage: vm.osImage,
        createdAt: vm.createdAt,
        hasGpu: vm.gpus.length > 0
      }));
    }),

    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => {
        const vm = mockVMs.find(v => v.id === input.id);
        if (!vm) return null;
        return {
          ...vm,
          metricsHistory: {
            cpu: generateMetricsHistory(vm.metrics.cpuUsage),
            memory: generateMetricsHistory(vm.metrics.memoryUsage),
            disk: generateMetricsHistory(vm.metrics.diskUsage)
          }
        };
      }),

    create: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        cpu: z.number().min(1).max(64),
        memory: z.string(),
        osImage: z.string(),
        disks: z.array(z.object({
          name: z.string(),
          size: z.string(),
          storageClassName: z.string(),
          boot: z.boolean(),
          image: z.string().optional()
        })),
        networks: z.array(z.object({
          name: z.string(),
          type: z.string().optional(),
          mode: z.enum(["dhcp", "static"]).optional(),
          ipAddress: z.string().optional(),
          gateway: z.string().optional()
        })),
        gpus: z.array(z.object({
          name: z.string(),
          deviceName: z.string()
        })).optional()
      }))
      .mutation(({ input }) => {
        const newId = `wukong-${input.name}-${Date.now()}`;
        return {
          success: true,
          id: newId,
          message: `Virtual machine "${input.name}" created successfully`
        };
      }),

    action: publicProcedure
      .input(z.object({
        id: z.string(),
        action: z.enum(["start", "stop", "restart", "delete"])
      }))
      .mutation(({ input }) => {
        const vm = mockVMs.find(v => v.id === input.id);
        if (!vm) {
          return { success: false, message: "Virtual machine not found" };
        }
        const actionMessages = {
          start: `Starting virtual machine "${vm.name}"...`,
          stop: `Stopping virtual machine "${vm.name}"...`,
          restart: `Restarting virtual machine "${vm.name}"...`,
          delete: `Deleting virtual machine "${vm.name}"...`
        };
        return { success: true, message: actionMessages[input.action] };
      }),

    stats: publicProcedure.query(() => {
      const running = mockVMs.filter(v => v.status === "Running").length;
      const stopped = mockVMs.filter(v => v.status === "Stopped").length;
      const error = mockVMs.filter(v => v.status === "Error").length;
      const pending = mockVMs.filter(v => v.status === "Pending").length;
      const totalCpu = mockVMs.reduce((sum, v) => sum + v.cpu, 0);
      const totalMemory = mockVMs.reduce((sum, v) => sum + parseInt(v.memory), 0);
      return {
        total: mockVMs.length,
        running,
        stopped,
        error,
        pending,
        totalCpu,
        totalMemory: `${totalMemory}Gi`
      };
    })
  }),

  snapshot: router({
    list: publicProcedure.query(() => mockSnapshots),

    listByVM: publicProcedure
      .input(z.object({ vmId: z.string() }))
      .query(({ input }) => {
        return mockSnapshots.filter(s => s.wukongId === input.vmId);
      }),

    create: publicProcedure
      .input(z.object({
        wukongId: z.string(),
        name: z.string().min(1)
      }))
      .mutation(({ input }) => {
        const vm = mockVMs.find(v => v.id === input.wukongId);
        if (!vm) {
          return { success: false, message: "Virtual machine not found" };
        }
        return {
          success: true,
          id: `snapshot-${Date.now()}`,
          message: `Creating snapshot "${input.name}" for "${vm.name}"...`
        };
      }),

    restore: publicProcedure
      .input(z.object({ snapshotId: z.string() }))
      .mutation(({ input }) => {
        const snapshot = mockSnapshots.find(s => s.id === input.snapshotId);
        if (!snapshot) {
          return { success: false, message: "Snapshot not found" };
        }
        return {
          success: true,
          message: `Restoring "${snapshot.wukongName}" from snapshot "${snapshot.name}"...`
        };
      }),

    delete: publicProcedure
      .input(z.object({ snapshotId: z.string() }))
      .mutation(({ input }) => {
        const snapshot = mockSnapshots.find(s => s.id === input.snapshotId);
        if (!snapshot) {
          return { success: false, message: "Snapshot not found" };
        }
        return {
          success: true,
          message: `Deleting snapshot "${snapshot.name}"...`
        };
      })
  })
});

export type AppRouter = typeof appRouter;
