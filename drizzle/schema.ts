import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Projects table for organizing VMs and resources.
 * Each project can have its own resource quota.
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  /** Kubernetes namespace associated with this project */
  namespace: varchar("namespace", { length: 64 }).notNull(),
  /** Owner user ID */
  ownerId: int("ownerId").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Project members table for multi-user access.
 */
export const projectMembers = mysqlTable("project_members", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "member", "viewer"]).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;

/**
 * Resource quotas table for limiting resource usage per project.
 * Each project has one quota record defining its resource limits.
 */
export const resourceQuotas = mysqlTable("resource_quotas", {
  id: int("id").autoincrement().primaryKey(),
  /** Associated project ID */
  projectId: int("projectId").notNull().unique(),
  /** Maximum number of VMs allowed */
  maxVMs: int("maxVMs").default(10).notNull(),
  /** Maximum total CPU cores across all VMs */
  maxCPU: int("maxCPU").default(32).notNull(),
  /** Maximum total memory in GB across all VMs */
  maxMemoryGB: int("maxMemoryGB").default(64).notNull(),
  /** Maximum total storage in GB across all VMs */
  maxStorageGB: int("maxStorageGB").default(500).notNull(),
  /** Maximum number of GPUs allowed */
  maxGPUs: int("maxGPUs").default(0).notNull(),
  /** Maximum number of snapshots allowed */
  maxSnapshots: int("maxSnapshots").default(20).notNull(),
  /** Whether quota enforcement is enabled */
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ResourceQuota = typeof resourceQuotas.$inferSelect;
export type InsertResourceQuota = typeof resourceQuotas.$inferInsert;

/**
 * Resource usage tracking table for real-time quota monitoring.
 * Updated whenever VMs are created, modified, or deleted.
 */
export const resourceUsage = mysqlTable("resource_usage", {
  id: int("id").autoincrement().primaryKey(),
  /** Associated project ID */
  projectId: int("projectId").notNull().unique(),
  /** Current number of VMs */
  usedVMs: int("usedVMs").default(0).notNull(),
  /** Current total CPU cores in use */
  usedCPU: int("usedCPU").default(0).notNull(),
  /** Current total memory in GB */
  usedMemoryGB: int("usedMemoryGB").default(0).notNull(),
  /** Current total storage in GB */
  usedStorageGB: int("usedStorageGB").default(0).notNull(),
  /** Current number of GPUs in use */
  usedGPUs: int("usedGPUs").default(0).notNull(),
  /** Current number of snapshots */
  usedSnapshots: int("usedSnapshots").default(0).notNull(),
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
});

export type ResourceUsage = typeof resourceUsage.$inferSelect;
export type InsertResourceUsage = typeof resourceUsage.$inferInsert;

/**
 * Quota templates for quick assignment of common quota profiles.
 */
export const quotaTemplates = mysqlTable("quota_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description"),
  maxVMs: int("maxVMs").notNull(),
  maxCPU: int("maxCPU").notNull(),
  maxMemoryGB: int("maxMemoryGB").notNull(),
  maxStorageGB: int("maxStorageGB").notNull(),
  maxGPUs: int("maxGPUs").notNull(),
  maxSnapshots: int("maxSnapshots").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuotaTemplate = typeof quotaTemplates.$inferSelect;
export type InsertQuotaTemplate = typeof quotaTemplates.$inferInsert;
