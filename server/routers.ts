import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

// Helper function to fetch data from Go backend
async function fetchFromGoBackend<T>(endpoint: string): Promise<T> {
  const goBackendUrl = process.env.GO_BACKEND_URL || "http://localhost:8081";
  const url = `${goBackendUrl}${endpoint}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Go backend error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
    }
    return await response.json() as T;
  } catch (error) {
    console.error(`Failed to fetch from Go backend ${url}:`, error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to connect to Go backend: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Helper function to post data to Go backend
async function postToGoBackend<T>(endpoint: string, data: unknown): Promise<T> {
  const goBackendUrl = process.env.GO_BACKEND_URL || "http://localhost:8081";
  const url = `${goBackendUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Go backend error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
    }
    
    return await response.json() as T;
  } catch (error) {
    console.error(`Failed to post to Go backend ${url}:`, error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to create VM in Go backend: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

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
    projectId: 1,
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
    projectId: 1,
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
    projectId: 2,
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
    projectId: 1,
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
    projectId: 2,
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
    projectId: 1,
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

// Helper to parse memory string to GB
function parseMemoryToGB(memory: string): number {
  const match = memory.match(/^(\d+)(Gi|G|Mi|M)?$/i);
  if (!match) return 0;
  const value = parseInt(match[1]);
  const unit = (match[2] || 'Gi').toLowerCase();
  if (unit === 'mi' || unit === 'm') return Math.ceil(value / 1024);
  return value;
}

// Helper to parse storage string to GB
function parseStorageToGB(size: string): number {
  return parseMemoryToGB(size);
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

  // ==================== Project Management ====================
  project: router({
    list: publicProcedure.query(async () => {
      const projects = await db.getAllProjects();
      return projects;
    }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const project = await db.getProjectById(input.id);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return project;
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(128),
        description: z.string().optional(),
        namespace: z.string().min(1).max(64),
      }))
      .mutation(async ({ input, ctx }) => {
        const projectId = await db.createProject({
          name: input.name,
          description: input.description || null,
          namespace: input.namespace,
          ownerId: ctx.user.id,
        });

        // Create default quota for the project
        await db.createResourceQuota({
          projectId,
          maxVMs: 10,
          maxCPU: 32,
          maxMemoryGB: 64,
          maxStorageGB: 500,
          maxGPUs: 0,
          maxSnapshots: 20,
          enabled: true,
        });

        // Initialize usage tracking
        await db.createResourceUsage({
          projectId,
          usedVMs: 0,
          usedCPU: 0,
          usedMemoryGB: 0,
          usedStorageGB: 0,
          usedGPUs: 0,
          usedSnapshots: 0,
        });

        return { success: true, id: projectId, message: `Project "${input.name}" created successfully` };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateProject(input.id, {
          name: input.name,
          description: input.description,
        });
        return { success: true, message: "Project updated successfully" };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProject(input.id);
        return { success: true, message: "Project deleted successfully" };
      }),

    members: publicProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        const members = await db.getProjectMembers(input.projectId);
        return members.map(m => ({
          id: m.member.id,
          userId: m.member.userId,
          userName: m.user.name,
          userEmail: m.user.email,
          role: m.member.role,
          createdAt: m.member.createdAt,
        }));
      }),

    addMember: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        userId: z.number(),
        role: z.enum(["admin", "member", "viewer"]),
      }))
      .mutation(async ({ input }) => {
        await db.addProjectMember({
          projectId: input.projectId,
          userId: input.userId,
          role: input.role,
        });
        return { success: true, message: "Member added successfully" };
      }),

    removeMember: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.removeProjectMember(input.projectId, input.userId);
        return { success: true, message: "Member removed successfully" };
      }),

    // Get projects for current user with their role
    myProjects: protectedProcedure.query(async ({ ctx }) => {
      const projects = await db.getUserProjectsWithRole(ctx.user.id);
      return projects;
    }),

    // Get or create default project for current user
    getDefault: protectedProcedure.query(async ({ ctx }) => {
      const project = await db.ensureUserHasDefaultProject(ctx.user.id, ctx.user.name);
      return project;
    }),

    // Check if user can access a project
    checkAccess: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input, ctx }) => {
        const canAccess = await db.canUserAccessProject(ctx.user.id, input.projectId);
        const canManage = await db.canUserManageProject(ctx.user.id, input.projectId);
        const role = await db.getUserRoleInProject(ctx.user.id, input.projectId);
        return { canAccess, canManage, role };
      }),

    // Update member role
    updateMemberRole: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        userId: z.number(),
        role: z.enum(["admin", "member", "viewer"]),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if current user can manage this project
        const canManage = await db.canUserManageProject(ctx.user.id, input.projectId);
        if (!canManage) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to manage this project" });
        }
        await db.updateProjectMemberRole(input.projectId, input.userId, input.role);
        return { success: true, message: "Member role updated successfully" };
      }),

    // Get all users (for adding members)
    allUsers: protectedProcedure.query(async () => {
      const users = await db.getAllUsers();
      return users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
      }));
    }),
  }),

  // ==================== Quota Management ====================
  quota: router({
    // Get quota and usage for a project
    get: publicProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        const { quota, usage } = await db.getQuotaAndUsage(input.projectId);
        return {
          quota: quota || null,
          usage: usage || null,
        };
      }),

    // Get all quotas with project info (admin view)
    list: publicProcedure.query(async () => {
      const quotas = await db.getAllQuotas();
      const result = [];
      
      for (const { quota, project } of quotas) {
        const usage = await db.getUsageByProjectId(quota.projectId);
        result.push({
          ...quota,
          projectName: project.name,
          projectNamespace: project.namespace,
          usage: usage || {
            usedVMs: 0,
            usedCPU: 0,
            usedMemoryGB: 0,
            usedStorageGB: 0,
            usedGPUs: 0,
            usedSnapshots: 0,
          },
        });
      }
      
      return result;
    }),

    // Update quota limits
    update: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        maxVMs: z.number().min(0).optional(),
        maxCPU: z.number().min(0).optional(),
        maxMemoryGB: z.number().min(0).optional(),
        maxStorageGB: z.number().min(0).optional(),
        maxGPUs: z.number().min(0).optional(),
        maxSnapshots: z.number().min(0).optional(),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { projectId, ...updates } = input;
        await db.updateResourceQuota(projectId, updates);
        return { success: true, message: "Quota updated successfully" };
      }),

    // Check if a VM creation would exceed quota
    check: publicProcedure
      .input(z.object({
        projectId: z.number(),
        cpu: z.number(),
        memoryGB: z.number(),
        storageGB: z.number(),
        gpus: z.number().default(0),
      }))
      .query(async ({ input }) => {
        const result = await db.checkQuotaForVM(
          input.projectId,
          input.cpu,
          input.memoryGB,
          input.storageGB,
          input.gpus
        );
        return result;
      }),

    // Check if a snapshot creation would exceed quota
    checkSnapshot: publicProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        const result = await db.checkQuotaForSnapshot(input.projectId);
        return result;
      }),

    // Apply a template to a project's quota
    applyTemplate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        templateId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const template = await db.getQuotaTemplateById(input.templateId);
        if (!template) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }
        
        await db.updateResourceQuota(input.projectId, {
          maxVMs: template.maxVMs,
          maxCPU: template.maxCPU,
          maxMemoryGB: template.maxMemoryGB,
          maxStorageGB: template.maxStorageGB,
          maxGPUs: template.maxGPUs,
          maxSnapshots: template.maxSnapshots,
        });
        
        return { success: true, message: `Applied template "${template.name}" successfully` };
      }),
  }),

  // ==================== Quota Templates ====================
  quotaTemplate: router({
    list: publicProcedure.query(async () => {
      return await db.getAllQuotaTemplates();
    }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const template = await db.getQuotaTemplateById(input.id);
        if (!template) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }
        return template;
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(64),
        description: z.string().optional(),
        maxVMs: z.number().min(0),
        maxCPU: z.number().min(0),
        maxMemoryGB: z.number().min(0),
        maxStorageGB: z.number().min(0),
        maxGPUs: z.number().min(0),
        maxSnapshots: z.number().min(0),
        isDefault: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createQuotaTemplate(input);
        return { success: true, id, message: `Template "${input.name}" created successfully` };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(64).optional(),
        description: z.string().optional(),
        maxVMs: z.number().min(0).optional(),
        maxCPU: z.number().min(0).optional(),
        maxMemoryGB: z.number().min(0).optional(),
        maxStorageGB: z.number().min(0).optional(),
        maxGPUs: z.number().min(0).optional(),
        maxSnapshots: z.number().min(0).optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateQuotaTemplate(id, updates);
        return { success: true, message: "Template updated successfully" };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteQuotaTemplate(input.id);
        return { success: true, message: "Template deleted successfully" };
      }),
  }),

  // ==================== Virtual Machine Management ====================
  vm: router({
    list: publicProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        // Start with mock data
        let vms = mockVMs;
        if (input?.projectId) {
          vms = mockVMs.filter(vm => vm.projectId === input.projectId);
        }
        
        // Transform mock data to frontend format
        const mockVMList = vms.map(vm => ({
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

        // Try to fetch real VMs from Go backend and merge
        try {
          const goVMs = await fetchFromGoBackend<Array<{
            id: string;
            name: string;
            namespace: string;
            status: string;
            cpu: number;
            memory: string;
            nodeName: string;
            ipAddress: string;
            osImage: string;
            createdAt: number;
            hasGpu: boolean;
            networks: Array<{ ipAddress: string }>;
            gpus: Array<unknown>;
          }>>("/api/vms");

          // Transform Go backend format to frontend format
          const goVMList = goVMs.map(vm => {
            // Normalize status to match frontend expected values
            let status: "Running" | "Stopped" | "Error" | "Pending" = "Pending";
            const statusLower = (vm.status || "Unknown").toLowerCase();
            if (statusLower === "running") {
              status = "Running";
            } else if (statusLower === "stopped") {
              status = "Stopped";
            } else if (statusLower === "error" || statusLower === "failed") {
              status = "Error";
            } else if (statusLower === "pending" || statusLower === "scheduling" || statusLower === "creating") {
              status = "Pending";
            }

            return {
              id: vm.id || vm.name,
              name: vm.name,
              status: status as "Running" | "Stopped" | "Error" | "Pending",
              cpu: vm.cpu || 0,
              memory: vm.memory || "0Gi",
              nodeName: vm.nodeName || "",
              ipAddress: vm.ipAddress || vm.networks?.[0]?.ipAddress || "",
              osImage: vm.osImage || "",
              createdAt: vm.createdAt || Date.now(),
              hasGpu: vm.hasGpu || (vm.gpus?.length || 0) > 0,
              projectId: input?.projectId || 1, // Default to project 1 if not specified
            };
          });

          // Merge: combine mock and Go backend data, removing duplicates by id or name
          const mergedVMs = [...mockVMList];
          const existingIds = new Set(mockVMList.map(vm => vm.id));
          const existingNames = new Set(mockVMList.map(vm => vm.name));

          for (const goVM of goVMList) {
            // Only add if not already exists (by id or name)
            if (!existingIds.has(goVM.id) && !existingNames.has(goVM.name)) {
              mergedVMs.push(goVM);
              existingIds.add(goVM.id);
              existingNames.add(goVM.name);
            }
          }

          return mergedVMs;
        } catch (error) {
          console.error("Failed to fetch VMs from Go backend, using mock data only:", error);
          // If Go backend fails, return mock data only
          return mockVMList;
        }
      }),

    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        try {
          // Try to fetch from Go backend by name (id might be UID, name is more reliable)
          // First, get the list to find the VM by id or name
          const goVMs = await fetchFromGoBackend<Array<{
            id: string;
            name: string;
            namespace: string;
            status: string;
            cpu: number;
            memory: string;
            nodeName: string;
            ipAddress: string;
            osImage: string;
            createdAt: number;
            hasGpu: boolean;
            networks: Array<{ name: string; interface: string; ipAddress: string; macAddress: string; mode: string }>;
            disks: Array<{ name: string; size: string; storageClassName: string; boot: boolean; image?: string }>;
            gpus: Array<{ name: string; deviceName: string }>;
            metrics?: { cpuUsage: number; memoryUsage: number; diskUsage: number };
          }>>("/api/vms");

          // Find VM by id or name
          const goVM = goVMs.find(v => v.id === input.id || v.name === input.id);
          
          if (goVM) {
            // Transform to frontend format
            return {
              id: goVM.id || goVM.name,
              name: goVM.name,
              status: goVM.status || "Unknown",
              cpu: goVM.cpu || 0,
              memory: goVM.memory || "0Gi",
              nodeName: goVM.nodeName || "",
              createdAt: goVM.createdAt || Date.now(),
              projectId: 1, // Default project
              networks: goVM.networks || [],
              disks: goVM.disks || [],
              gpus: goVM.gpus || [],
              osImage: goVM.osImage || "",
              metrics: goVM.metrics || { cpuUsage: 0, memoryUsage: 0, diskUsage: 0 },
              metricsHistory: {
                cpu: generateMetricsHistory(goVM.metrics?.cpuUsage || 0),
                memory: generateMetricsHistory(goVM.metrics?.memoryUsage || 0),
                disk: generateMetricsHistory(goVM.metrics?.diskUsage || 0)
              }
            };
          }

          // If not found in Go backend, try to get by name directly
          try {
            const vmDetail = await fetchFromGoBackend<{
              id: string;
              name: string;
              namespace: string;
              status: string;
              cpu: number;
              memory: string;
              nodeName: string;
              ipAddress: string;
              osImage: string;
              createdAt: number;
              hasGpu: boolean;
              networks: Array<{ name: string; interface: string; ipAddress: string; macAddress: string; mode: string }>;
              disks: Array<{ name: string; size: string; storageClassName: string; boot: boolean; image?: string }>;
              gpus: Array<{ name: string; deviceName: string }>;
              metrics?: { cpuUsage: number; memoryUsage: number; diskUsage: number };
            }>(`/api/vms/${input.id}`);

            return {
              id: vmDetail.id || vmDetail.name,
              name: vmDetail.name,
              status: vmDetail.status || "Unknown",
              cpu: vmDetail.cpu || 0,
              memory: vmDetail.memory || "0Gi",
              nodeName: vmDetail.nodeName || "",
              createdAt: vmDetail.createdAt || Date.now(),
              projectId: 1,
              networks: vmDetail.networks || [],
              disks: vmDetail.disks || [],
              gpus: vmDetail.gpus || [],
              osImage: vmDetail.osImage || "",
              metrics: vmDetail.metrics || { cpuUsage: 0, memoryUsage: 0, diskUsage: 0 },
              metricsHistory: {
                cpu: generateMetricsHistory(vmDetail.metrics?.cpuUsage || 0),
                memory: generateMetricsHistory(vmDetail.metrics?.memoryUsage || 0),
                disk: generateMetricsHistory(vmDetail.metrics?.diskUsage || 0)
              }
            };
          } catch {
            // Fall through to mock data
          }
        } catch (error) {
          console.error("Failed to fetch VM from Go backend, falling back to mock data:", error);
        }

        // Fallback to mock data
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
        projectId: z.number().optional(),
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
      .mutation(async ({ input }) => {
        // Check quota if projectId is provided
        if (input.projectId) {
          const memoryGB = parseMemoryToGB(input.memory);
          const storageGB = input.disks.reduce((sum, d) => sum + parseStorageToGB(d.size), 0);
          const gpuCount = input.gpus?.length || 0;
          
          const quotaCheck = await db.checkQuotaForVM(
            input.projectId,
            input.cpu,
            memoryGB,
            storageGB,
            gpuCount
          );
          
          if (!quotaCheck.allowed) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: quotaCheck.reason || "Quota exceeded",
            });
          }
        }

        // TODO: Network type validation and mapping
        // Wukong CRD supports: "bridge", "macvlan", "sriov", "ovs"
        // Frontend may send "pod" which is not supported - need to handle this
        // For now, filter out unsupported types or map them
        
        // Prepare request data for Go backend
        const goBackendRequest = {
          name: input.name,
          cpu: input.cpu,
          memory: input.memory,
          osImage: input.osImage,
          disks: input.disks.map(disk => ({
            name: disk.name,
            size: disk.size,
            storageClassName: disk.storageClassName,
            boot: disk.boot,
            ...(disk.image && { image: disk.image }),
          })),
          networks: input.networks
            // Filter out unsupported network types for now
            .filter(network => {
              const supportedTypes = ["bridge", "macvlan", "sriov", "ovs"];
              if (network.type && !supportedTypes.includes(network.type)) {
                console.warn(`Network type "${network.type}" is not supported by Wukong CRD. Supported types: ${supportedTypes.join(", ")}`);
                return false;
              }
              return true;
            })
            .map(network => ({
              name: network.name,
              // Only include type if it's supported
              ...(network.type && { type: network.type }),
              ...(network.mode && { mode: network.mode }),
              ...(network.ipAddress && { ipAddress: network.ipAddress }),
              ...(network.gateway && { gateway: network.gateway }),
            })),
          ...(input.gpus && input.gpus.length > 0 && {
            gpus: input.gpus.map(gpu => ({
              name: gpu.name,
              deviceName: gpu.deviceName,
            })),
          }),
        };

        // Create VM in Go backend (Kubernetes)
        // Note: Go backend uses "default" namespace if not specified in query
        try {
          // Get namespace from project if available, otherwise use "default"
          const namespace = "default"; // TODO: Get namespace from project configuration
          const endpoint = `/api/vms${namespace !== "default" ? `?namespace=${namespace}` : ""}`;
          
          const result = await postToGoBackend<{
            success: boolean;
            id: string;
            name: string;
            message: string;
          }>(endpoint, goBackendRequest);

          // Update quota usage after successful creation
          if (input.projectId) {
            const memoryGB = parseMemoryToGB(input.memory);
            const storageGB = input.disks.reduce((sum, d) => sum + parseStorageToGB(d.size), 0);
            const gpuCount = input.gpus?.length || 0;
            
            const currentUsage = await db.getUsageByProjectId(input.projectId);
            if (currentUsage) {
              await db.updateResourceUsage(input.projectId, {
                usedVMs: currentUsage.usedVMs + 1,
                usedCPU: currentUsage.usedCPU + input.cpu,
                usedMemoryGB: currentUsage.usedMemoryGB + memoryGB,
                usedStorageGB: currentUsage.usedStorageGB + storageGB,
                usedGPUs: currentUsage.usedGPUs + gpuCount,
              });
            }
          }

          return {
            success: result.success,
            id: result.id || result.name,
            message: result.message || `Virtual machine "${input.name}" created successfully`,
          };
        } catch (error) {
          // If Go backend fails, throw the error (don't create mock VM)
          throw error;
        }
      }),

    action: publicProcedure
      .input(z.object({
        id: z.string(),
        action: z.enum(["start", "stop", "restart", "delete"])
      }))
      .mutation(async ({ input }) => {
        const vm = mockVMs.find(v => v.id === input.id);
        if (!vm) {
          return { success: false, message: "Virtual machine not found" };
        }
        
        // If deleting, update usage
        if (input.action === "delete" && vm.projectId) {
          const currentUsage = await db.getUsageByProjectId(vm.projectId);
          if (currentUsage) {
            const memoryGB = parseMemoryToGB(vm.memory);
            const storageGB = vm.disks.reduce((sum, d) => sum + parseStorageToGB(d.size), 0);
            const gpuCount = vm.gpus.length;
            
            await db.updateResourceUsage(vm.projectId, {
              usedVMs: Math.max(0, currentUsage.usedVMs - 1),
              usedCPU: Math.max(0, currentUsage.usedCPU - vm.cpu),
              usedMemoryGB: Math.max(0, currentUsage.usedMemoryGB - memoryGB),
              usedStorageGB: Math.max(0, currentUsage.usedStorageGB - storageGB),
              usedGPUs: Math.max(0, currentUsage.usedGPUs - gpuCount),
            });
          }
        }
        
        const actionMessages = {
          start: `Starting virtual machine "${vm.name}"...`,
          stop: `Stopping virtual machine "${vm.name}"...`,
          restart: `Restarting virtual machine "${vm.name}"...`,
          delete: `Deleting virtual machine "${vm.name}"...`
        };
        return { success: true, message: actionMessages[input.action] };
      }),

    stats: publicProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        try {
          // Fetch stats from Go backend
          const stats = await fetchFromGoBackend<{
            total: number;
            running: number;
            stopped: number;
            error: number;
            pending: number;
            totalCpu: number;
            totalMemory: string;
          }>("/api/vms/stats");

          return stats;
        } catch (fetchError) {
          console.error("Failed to fetch stats from Go backend, falling back to mock data:", fetchError);
          // Fallback to mock data
          let vms = mockVMs;
          if (input?.projectId) {
            vms = mockVMs.filter(vm => vm.projectId === input.projectId);
          }
          const total = vms.length;
          const running = vms.filter(vm => vm.status === "Running").length;
          const stopped = vms.filter(vm => vm.status === "Stopped").length;
          const errorCount = vms.filter(vm => vm.status === "Error").length;
          const pending = vms.filter(vm => vm.status === "Pending").length;
          const totalCpu = vms.reduce((sum, vm) => sum + vm.cpu, 0);
          
          // Calculate total memory (simplified)
          const totalMemoryGi = vms.reduce((sum, vm) => {
            const memStr = vm.memory.replace("Gi", "");
            return sum + parseInt(memStr) || 0;
          }, 0);

          return {
            total,
            running,
            stopped,
            error: errorCount,
            pending,
            totalCpu,
            totalMemory: `${totalMemoryGi}Gi`,
          };
        }
      })
  }),

  // ==================== Snapshot Management ====================
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
        name: z.string().min(1),
        projectId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const vm = mockVMs.find(v => v.id === input.wukongId);
        if (!vm) {
          return { success: false, message: "Virtual machine not found" };
        }
        
        // Check snapshot quota if projectId is provided
        const projectId = input.projectId || vm.projectId;
        if (projectId) {
          const quotaCheck = await db.checkQuotaForSnapshot(projectId);
          
          if (!quotaCheck.allowed) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: quotaCheck.reason || "Snapshot quota exceeded",
            });
          }
          
          // Update usage
          const currentUsage = await db.getUsageByProjectId(projectId);
          if (currentUsage) {
            await db.updateResourceUsage(projectId, {
              usedSnapshots: currentUsage.usedSnapshots + 1,
            });
          }
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
      .input(z.object({ 
        snapshotId: z.string(),
        projectId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const snapshot = mockSnapshots.find(s => s.id === input.snapshotId);
        if (!snapshot) {
          return { success: false, message: "Snapshot not found" };
        }
        
        // Update usage if projectId is provided
        if (input.projectId) {
          const currentUsage = await db.getUsageByProjectId(input.projectId);
          if (currentUsage) {
            await db.updateResourceUsage(input.projectId, {
              usedSnapshots: Math.max(0, currentUsage.usedSnapshots - 1),
            });
          }
        }
        
        return {
          success: true,
          message: `Deleting snapshot "${snapshot.name}"...`
        };
      })
  })
});

export type AppRouter = typeof appRouter;
