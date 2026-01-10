import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  projects, 
  projectMembers,
  resourceQuotas, 
  resourceUsage,
  quotaTemplates,
  InsertProject,
  InsertResourceQuota,
  InsertResourceUsage,
  InsertQuotaTemplate,
  InsertProjectMember,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== Project Queries ====================

export async function createProject(project: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(projects).values(project);
  return result[0].insertId;
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProjectsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get projects where user is owner or member
  const ownedProjects = await db.select().from(projects).where(eq(projects.ownerId, userId));
  
  const memberProjects = await db
    .select({ project: projects })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));
  
  const allProjects = [...ownedProjects, ...memberProjects.map(m => m.project)];
  // Remove duplicates
  const uniqueProjects = allProjects.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
  return uniqueProjects;
}

export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(projects);
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete related records first
  await db.delete(projectMembers).where(eq(projectMembers.projectId, id));
  await db.delete(resourceQuotas).where(eq(resourceQuotas.projectId, id));
  await db.delete(resourceUsage).where(eq(resourceUsage.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
}

// ==================== Project Member Queries ====================

export async function addProjectMember(member: InsertProjectMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(projectMembers).values(member);
}

export async function removeProjectMember(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(projectMembers).where(
    and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))
  );
}

export async function getProjectMembers(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({ member: projectMembers, user: users })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));
}

// ==================== Resource Quota Queries ====================

export async function createResourceQuota(quota: InsertResourceQuota) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(resourceQuotas).values(quota);
  return result[0].insertId;
}

export async function getQuotaByProjectId(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(resourceQuotas).where(eq(resourceQuotas.projectId, projectId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateResourceQuota(projectId: number, data: Partial<InsertResourceQuota>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(resourceQuotas).set(data).where(eq(resourceQuotas.projectId, projectId));
}

export async function getAllQuotas() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({ quota: resourceQuotas, project: projects })
    .from(resourceQuotas)
    .innerJoin(projects, eq(resourceQuotas.projectId, projects.id));
}

// ==================== Resource Usage Queries ====================

export async function createResourceUsage(usage: InsertResourceUsage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(resourceUsage).values(usage);
}

export async function getUsageByProjectId(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(resourceUsage).where(eq(resourceUsage.projectId, projectId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateResourceUsage(projectId: number, data: Partial<InsertResourceUsage>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(resourceUsage).set(data).where(eq(resourceUsage.projectId, projectId));
}

export async function getQuotaAndUsage(projectId: number) {
  const db = await getDb();
  if (!db) return { quota: undefined, usage: undefined };
  
  const quota = await getQuotaByProjectId(projectId);
  const usage = await getUsageByProjectId(projectId);
  
  return { quota, usage };
}

// ==================== Quota Template Queries ====================

export async function createQuotaTemplate(template: InsertQuotaTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(quotaTemplates).values(template);
  return result[0].insertId;
}

export async function getAllQuotaTemplates() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(quotaTemplates);
}

export async function getQuotaTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(quotaTemplates).where(eq(quotaTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateQuotaTemplate(id: number, data: Partial<InsertQuotaTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(quotaTemplates).set(data).where(eq(quotaTemplates.id, id));
}

export async function deleteQuotaTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(quotaTemplates).where(eq(quotaTemplates.id, id));
}

// ==================== Quota Check Helpers ====================

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  current: {
    vms: number;
    cpu: number;
    memoryGB: number;
    storageGB: number;
    gpus: number;
    snapshots: number;
  };
  limit: {
    vms: number;
    cpu: number;
    memoryGB: number;
    storageGB: number;
    gpus: number;
    snapshots: number;
  };
  requested?: {
    cpu: number;
    memoryGB: number;
    storageGB: number;
    gpus: number;
  };
}

export async function checkQuotaForVM(
  projectId: number, 
  requestedCPU: number, 
  requestedMemoryGB: number, 
  requestedStorageGB: number,
  requestedGPUs: number = 0
): Promise<QuotaCheckResult> {
  const { quota, usage } = await getQuotaAndUsage(projectId);
  
  // If no quota is set, allow by default
  if (!quota) {
    return {
      allowed: true,
      current: { vms: 0, cpu: 0, memoryGB: 0, storageGB: 0, gpus: 0, snapshots: 0 },
      limit: { vms: 999, cpu: 999, memoryGB: 999, storageGB: 9999, gpus: 999, snapshots: 999 },
    };
  }
  
  // If quota enforcement is disabled, allow
  if (!quota.enabled) {
    return {
      allowed: true,
      current: {
        vms: usage?.usedVMs || 0,
        cpu: usage?.usedCPU || 0,
        memoryGB: usage?.usedMemoryGB || 0,
        storageGB: usage?.usedStorageGB || 0,
        gpus: usage?.usedGPUs || 0,
        snapshots: usage?.usedSnapshots || 0,
      },
      limit: {
        vms: quota.maxVMs,
        cpu: quota.maxCPU,
        memoryGB: quota.maxMemoryGB,
        storageGB: quota.maxStorageGB,
        gpus: quota.maxGPUs,
        snapshots: quota.maxSnapshots,
      },
    };
  }
  
  const currentUsage = {
    vms: usage?.usedVMs || 0,
    cpu: usage?.usedCPU || 0,
    memoryGB: usage?.usedMemoryGB || 0,
    storageGB: usage?.usedStorageGB || 0,
    gpus: usage?.usedGPUs || 0,
    snapshots: usage?.usedSnapshots || 0,
  };
  
  const limits = {
    vms: quota.maxVMs,
    cpu: quota.maxCPU,
    memoryGB: quota.maxMemoryGB,
    storageGB: quota.maxStorageGB,
    gpus: quota.maxGPUs,
    snapshots: quota.maxSnapshots,
  };
  
  const requested = {
    cpu: requestedCPU,
    memoryGB: requestedMemoryGB,
    storageGB: requestedStorageGB,
    gpus: requestedGPUs,
  };
  
  // Check VM count
  if (currentUsage.vms + 1 > limits.vms) {
    return {
      allowed: false,
      reason: `VM limit exceeded. Current: ${currentUsage.vms}, Limit: ${limits.vms}`,
      current: currentUsage,
      limit: limits,
      requested,
    };
  }
  
  // Check CPU
  if (currentUsage.cpu + requestedCPU > limits.cpu) {
    return {
      allowed: false,
      reason: `CPU quota exceeded. Current: ${currentUsage.cpu}, Requested: ${requestedCPU}, Limit: ${limits.cpu}`,
      current: currentUsage,
      limit: limits,
      requested,
    };
  }
  
  // Check Memory
  if (currentUsage.memoryGB + requestedMemoryGB > limits.memoryGB) {
    return {
      allowed: false,
      reason: `Memory quota exceeded. Current: ${currentUsage.memoryGB}GB, Requested: ${requestedMemoryGB}GB, Limit: ${limits.memoryGB}GB`,
      current: currentUsage,
      limit: limits,
      requested,
    };
  }
  
  // Check Storage
  if (currentUsage.storageGB + requestedStorageGB > limits.storageGB) {
    return {
      allowed: false,
      reason: `Storage quota exceeded. Current: ${currentUsage.storageGB}GB, Requested: ${requestedStorageGB}GB, Limit: ${limits.storageGB}GB`,
      current: currentUsage,
      limit: limits,
      requested,
    };
  }
  
  // Check GPUs
  if (requestedGPUs > 0 && currentUsage.gpus + requestedGPUs > limits.gpus) {
    return {
      allowed: false,
      reason: `GPU quota exceeded. Current: ${currentUsage.gpus}, Requested: ${requestedGPUs}, Limit: ${limits.gpus}`,
      current: currentUsage,
      limit: limits,
      requested,
    };
  }
  
  return {
    allowed: true,
    current: currentUsage,
    limit: limits,
    requested,
  };
}

export async function checkQuotaForSnapshot(projectId: number): Promise<QuotaCheckResult> {
  const { quota, usage } = await getQuotaAndUsage(projectId);
  
  if (!quota || !quota.enabled) {
    return {
      allowed: true,
      current: { vms: 0, cpu: 0, memoryGB: 0, storageGB: 0, gpus: 0, snapshots: usage?.usedSnapshots || 0 },
      limit: { vms: 999, cpu: 999, memoryGB: 999, storageGB: 9999, gpus: 999, snapshots: 999 },
    };
  }
  
  const currentUsage = {
    vms: usage?.usedVMs || 0,
    cpu: usage?.usedCPU || 0,
    memoryGB: usage?.usedMemoryGB || 0,
    storageGB: usage?.usedStorageGB || 0,
    gpus: usage?.usedGPUs || 0,
    snapshots: usage?.usedSnapshots || 0,
  };
  
  const limits = {
    vms: quota.maxVMs,
    cpu: quota.maxCPU,
    memoryGB: quota.maxMemoryGB,
    storageGB: quota.maxStorageGB,
    gpus: quota.maxGPUs,
    snapshots: quota.maxSnapshots,
  };
  
  if (currentUsage.snapshots + 1 > limits.snapshots) {
    return {
      allowed: false,
      reason: `Snapshot limit exceeded. Current: ${currentUsage.snapshots}, Limit: ${limits.snapshots}`,
      current: currentUsage,
      limit: limits,
    };
  }
  
  return {
    allowed: true,
    current: currentUsage,
    limit: limits,
  };
}


// ==================== User-Project Association Queries ====================

type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export type ProjectWithRole = {
  id: number;
  name: string;
  description: string | null;
  namespace: string;
  ownerId: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  userRole: ProjectRole;
};

export async function getUserProjectsWithRole(userId: number): Promise<ProjectWithRole[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Get projects where user is owner
  const ownedProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, userId));
  
  const ownedWithRole: ProjectWithRole[] = ownedProjects.map(p => ({
    ...p,
    userRole: 'owner' as ProjectRole,
  }));
  
  // Get projects where user is member
  const memberRecords = await db
    .select({ project: projects, role: projectMembers.role })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));
  
  const memberWithRole: ProjectWithRole[] = memberRecords.map(m => ({
    ...m.project,
    userRole: m.role as ProjectRole,
  }));
  
  // Combine and deduplicate (owner takes precedence)
  const allProjects: ProjectWithRole[] = [...ownedWithRole];
  for (const mp of memberWithRole) {
    if (!allProjects.find(p => p.id === mp.id)) {
      allProjects.push(mp);
    }
  }
  
  return allProjects;
}

export async function getDefaultProjectForUser(userId: number): Promise<ProjectWithRole | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  // First try to find user's default project
  const userProjects = await getUserProjectsWithRole(userId);
  
  // Return the first owned project, or first project with admin role, or first project
  const owned = userProjects.find(p => p.userRole === 'owner');
  if (owned) return owned;
  
  const admin = userProjects.find(p => p.userRole === 'admin');
  if (admin) return admin;
  
  return userProjects[0];
}

export async function ensureUserHasDefaultProject(userId: number, userName?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if user already has projects
  const existingProjects = await getUserProjectsWithRole(userId);
  if (existingProjects.length > 0) {
    return existingProjects[0];
  }
  
  // Create a default project for the user
  const projectName = userName ? `${userName}'s Project` : `Project ${userId}`;
  const namespace = `wukong-user-${userId}`;
  
  const projectId = await createProject({
    name: projectName,
    description: 'Default project',
    namespace,
    ownerId: userId,
    isDefault: true,
  });
  
  // Create default quota for the project
  await createResourceQuota({
    projectId,
    maxVMs: 5,
    maxCPU: 16,
    maxMemoryGB: 32,
    maxStorageGB: 200,
    maxGPUs: 0,
    maxSnapshots: 10,
    enabled: true,
  });
  
  // Create initial usage record
  await createResourceUsage({
    projectId,
    usedVMs: 0,
    usedCPU: 0,
    usedMemoryGB: 0,
    usedStorageGB: 0,
    usedGPUs: 0,
    usedSnapshots: 0,
  });
  
  const project = await getProjectById(projectId);
  return project ? { ...project, userRole: 'owner' as const } : undefined;
}

export async function getUserRoleInProject(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Check if user is owner
  const project = await getProjectById(projectId);
  if (project?.ownerId === userId) {
    return 'owner';
  }
  
  // Check membership
  const membership = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  
  return membership.length > 0 ? membership[0].role : undefined;
}

export async function canUserAccessProject(userId: number, projectId: number) {
  const role = await getUserRoleInProject(userId, projectId);
  return role !== undefined;
}

export async function canUserManageProject(userId: number, projectId: number) {
  const role = await getUserRoleInProject(userId, projectId);
  return role === 'owner' || role === 'admin';
}

export async function updateProjectMemberRole(projectId: number, userId: number, role: 'admin' | 'member' | 'viewer') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(projectMembers)
    .set({ role })
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(users);
}
