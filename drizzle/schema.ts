import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, bigint } from "drizzle-orm/mysql-core";

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

/**
 * MFA (Multi-Factor Authentication) settings per user.
 * Stores TOTP secrets and backup codes for 2FA.
 */
export const userMfaSettings = mysqlTable("user_mfa_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** User ID */
  userId: int("userId").notNull().unique(),
  /** TOTP secret (encrypted) */
  totpSecret: varchar("totpSecret", { length: 255 }),
  /** Whether TOTP is enabled */
  totpEnabled: boolean("totpEnabled").default(false).notNull(),
  /** Backup codes (JSON array, encrypted) */
  backupCodes: json("backupCodes"),
  /** Whether backup codes have been generated */
  backupCodesGenerated: boolean("backupCodesGenerated").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserMfaSettings = typeof userMfaSettings.$inferSelect;
export type InsertUserMfaSettings = typeof userMfaSettings.$inferInsert;

/**
 * User sessions for session management.
 * Tracks active sessions and device information.
 */
export const userSessions = mysqlTable("user_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** User ID */
  userId: int("userId").notNull(),
  /** Session token (hashed) */
  sessionToken: varchar("sessionToken", { length: 255 }).notNull().unique(),
  /** Device name/description */
  deviceName: varchar("deviceName", { length: 128 }),
  /** User agent */
  userAgent: text("userAgent"),
  /** IP address */
  ipAddress: varchar("ipAddress", { length: 45 }),
  /** Last activity timestamp */
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  /** Session expiry timestamp */
  expiresAt: timestamp("expiresAt").notNull(),
  /** Whether session is active */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

/**
 * OIDC provider configuration.
 * Stores configuration for different OIDC providers (e.g., Azure AD, Google, Okta).
 */
export const oidcProviders = mysqlTable("oidc_providers", {
  id: int("id").autoincrement().primaryKey(),
  /** Provider name (e.g., 'azure-ad', 'google', 'okta') */
  name: varchar("name", { length: 64 }).notNull().unique(),
  /** Display name */
  displayName: varchar("displayName", { length: 128 }).notNull(),
  /** OIDC discovery URL */
  discoveryUrl: text("discoveryUrl").notNull(),
  /** Client ID */
  clientId: varchar("clientId", { length: 255 }).notNull(),
  /** Client secret (encrypted) */
  clientSecret: varchar("clientSecret", { length: 255 }).notNull(),
  /** Redirect URI */
  redirectUri: text("redirectUri").notNull(),
  /** Scopes to request */
  scopes: varchar("scopes", { length: 512 }).default("openid profile email").notNull(),
  /** Whether this provider is enabled */
  enabled: boolean("enabled").default(true).notNull(),
  /** Whether this is the default provider */
  isDefault: boolean("isDefault").default(false).notNull(),
  /** Additional configuration (JSON) */
  config: json("config"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OidcProvider = typeof oidcProviders.$inferSelect;
export type InsertOidcProvider = typeof oidcProviders.$inferInsert;

/**
 * User OIDC identities.
 * Maps users to their OIDC provider identities.
 */
export const userOidcIdentities = mysqlTable("user_oidc_identities", {
  id: int("id").autoincrement().primaryKey(),
  /** User ID */
  userId: int("userId").notNull(),
  /** OIDC provider ID */
  providerId: int("providerId").notNull(),
  /** Subject (sub) claim from OIDC provider */
  subject: varchar("subject", { length: 255 }).notNull(),
  /** Additional claims (JSON) */
  claims: json("claims"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserOidcIdentity = typeof userOidcIdentities.$inferSelect;
export type InsertUserOidcIdentity = typeof userOidcIdentities.$inferInsert;

/**
 * Audit logs for security and compliance.
 * Tracks important security events like login, MFA changes, etc.
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: bigint("id", { mode: "bigint" }).autoincrement().primaryKey(),
  /** User ID (nullable for system events) */
  userId: int("userId"),
  /** Event type (e.g., 'login', 'mfa_enabled', 'session_created') */
  eventType: varchar("eventType", { length: 64 }).notNull(),
  /** Event description */
  description: text("description"),
  /** IP address */
  ipAddress: varchar("ipAddress", { length: 45 }),
  /** User agent */
  userAgent: text("userAgent"),
  /** Event metadata (JSON) */
  metadata: json("metadata"),
  /** Severity level (info, warning, error) */
  severity: mysqlEnum("severity", ["info", "warning", "error"]).default("info").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
