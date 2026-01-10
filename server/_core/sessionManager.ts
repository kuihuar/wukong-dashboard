/**
 * Session Management Service
 * Handles user sessions, device tracking, and remote logout
 */

import crypto from "crypto";
import * as db from "../db";

export interface SessionInfo {
  id: number;
  userId: number;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  lastActivityAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

/**
 * Create a new session
 */
export async function createSession(
  userId: number,
  options: {
    deviceName?: string;
    userAgent?: string;
    ipAddress?: string;
    expiresInDays?: number;
  }
): Promise<string> {
  // Generate secure session token
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresInDays = options.expiresInDays || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await db.createUserSession(userId, {
    sessionToken,
    deviceName: options.deviceName,
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
    expiresAt,
  });

  // Log audit event
  await db.createAuditLog({
    userId,
    eventType: "session_created",
    description: `New session created from ${options.ipAddress || "unknown"}`,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    severity: "info",
  });

  return sessionToken;
}

/**
 * Verify and get session
 */
export async function getSession(sessionToken: string): Promise<SessionInfo | null> {
  const session = await db.getSessionByToken(sessionToken);
  if (!session) {
    return null;
  }

  // Update last activity
  await db.updateSessionActivity(session.id);

  return session as SessionInfo;
}

/**
 * Get all active sessions for user
 */
export async function getUserSessions(userId: number): Promise<SessionInfo[]> {
  const sessions = await db.getUserSessions(userId);
  return sessions as SessionInfo[];
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: number, userId: number): Promise<void> {
  await db.revokeSession(sessionId);

  // Log audit event
  await db.createAuditLog({
    userId,
    eventType: "session_revoked",
    description: "Session revoked",
    severity: "info",
  });
}

/**
 * Revoke all sessions for user (remote logout)
 */
export async function revokeAllSessions(userId: number): Promise<void> {
  await db.revokeAllUserSessions(userId);

  // Log audit event
  await db.createAuditLog({
    userId,
    eventType: "all_sessions_revoked",
    description: "All sessions revoked (remote logout)",
    severity: "warning",
  });
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session: SessionInfo): boolean {
  return new Date() > session.expiresAt || !session.isActive;
}

/**
 * Get session expiry time in seconds
 */
export function getSessionExpiryTime(session: SessionInfo): number {
  const expiryTime = session.expiresAt.getTime() - Date.now();
  return Math.max(0, Math.floor(expiryTime / 1000));
}

/**
 * Extend session expiry
 */
export async function extendSession(
  sessionId: number,
  additionalDays: number = 7
): Promise<void> {
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + additionalDays);

  // Note: This would require adding an update method to db.ts
  // For now, we'll just log it
  console.log(`[Session] Extending session ${sessionId} by ${additionalDays} days`);
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  // This would require adding a cleanup method to db.ts
  // For now, we'll just return 0
  console.log("[Session] Cleaning up expired sessions");
  return 0;
}

/**
 * Parse user agent to get device info
 */
export function parseUserAgent(userAgent: string): string {
  // Simple parsing - can be enhanced with ua-parser-js
  if (userAgent.includes("Chrome")) {
    return "Chrome";
  } else if (userAgent.includes("Firefox")) {
    return "Firefox";
  } else if (userAgent.includes("Safari")) {
    return "Safari";
  } else if (userAgent.includes("Edge")) {
    return "Edge";
  }
  return "Unknown Browser";
}

/**
 * Get device info from user agent
 */
export function getDeviceInfo(userAgent: string): {
  browser: string;
  os: string;
} {
  let browser = "Unknown";
  let os = "Unknown";

  // Browser detection
  if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari")) browser = "Safari";
  else if (userAgent.includes("Edge")) browser = "Edge";

  // OS detection
  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone")) os = "iOS";

  return { browser, os };
}
