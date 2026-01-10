/**
 * Multi-Factor Authentication (MFA) Service
 * Supports TOTP (Time-based One-Time Password) and backup codes
 */

import speakeasy from "speakeasy";
import QRCode from "qrcode";
import * as db from "../db";

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MfaVerifyResponse {
  success: boolean;
  message: string;
}

/**
 * Generate TOTP secret and QR code for user
 */
export async function generateMfaSecret(
  userId: number,
  userEmail: string
): Promise<MfaSetupResponse> {
  // Generate TOTP secret
  const secret = speakeasy.generateSecret({
    name: `Wukong Dashboard (${userEmail})`,
    issuer: "Wukong Dashboard",
    length: 32,
  });

  if (!secret.otpauth_url) {
    throw new Error("Failed to generate TOTP secret");
  }

  // Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);

  return {
    secret: secret.base32,
    qrCode,
    backupCodes,
  };
}

/**
 * Verify TOTP token
 */
export function verifyTotpToken(secret: string, token: string): boolean {
  try {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2, // Allow 2 time windows (30 seconds each)
    });
    return verified;
  } catch (error) {
    console.error("[MFA] TOTP verification failed:", error);
    return false;
  }
}

/**
 * Enable MFA for user
 */
export async function enableMfa(
  userId: number,
  totpSecret: string,
  backupCodes: string[]
): Promise<void> {
  const mfaSettings = await db.getUserMfaSettings(userId);

  if (mfaSettings) {
    // Update existing MFA settings
    await db.updateUserMfaSettings(userId, {
      totpSecret,
      totpEnabled: true,
      backupCodes,
      backupCodesGenerated: true,
    });
  } else {
    // Create new MFA settings
    await db.createUserMfaSettings(userId);
    await db.updateUserMfaSettings(userId, {
      totpSecret,
      totpEnabled: true,
      backupCodes,
      backupCodesGenerated: true,
    });
  }

  // Log audit event
  await db.createAuditLog({
    userId,
    eventType: "mfa_enabled",
    description: "Multi-factor authentication enabled",
    severity: "info",
  });
}

/**
 * Disable MFA for user
 */
export async function disableMfa(userId: number): Promise<void> {
  await db.updateUserMfaSettings(userId, {
    totpEnabled: false,
    totpSecret: undefined,
    backupCodes: undefined,
    backupCodesGenerated: false,
  });

  // Log audit event
  await db.createAuditLog({
    userId,
    eventType: "mfa_disabled",
    description: "Multi-factor authentication disabled",
    severity: "warning",
  });
}

/**
 * Verify MFA (TOTP or backup code)
 */
export async function verifyMfa(
  userId: number,
  token: string
): Promise<MfaVerifyResponse> {
  const mfaSettings = await db.getUserMfaSettings(userId);

  if (!mfaSettings || !mfaSettings.totpEnabled) {
    return {
      success: false,
      message: "MFA not enabled for this user",
    };
  }

  if (!mfaSettings.totpSecret) {
    return {
      success: false,
      message: "TOTP secret not configured",
    };
  }

  // Try TOTP verification first
  if (verifyTotpToken(mfaSettings.totpSecret, token)) {
    return {
      success: true,
      message: "MFA verification successful",
    };
  }

  // Try backup code verification
  if (mfaSettings.backupCodes) {
    const backupCodes = Array.isArray(mfaSettings.backupCodes)
      ? mfaSettings.backupCodes
      : [];

    const codeIndex = backupCodes.indexOf(token);
    if (codeIndex !== -1) {
      // Remove used backup code
      backupCodes.splice(codeIndex, 1);
      await db.updateUserMfaSettings(userId, {
        backupCodes,
      });

      // Log audit event
      await db.createAuditLog({
        userId,
        eventType: "mfa_backup_code_used",
        description: `Backup code used (${backupCodes.length} remaining)`,
        severity: "info",
      });

      return {
        success: true,
        message: "MFA verification successful (backup code)",
      };
    }
  }

  // Log failed attempt
  await db.createAuditLog({
    userId,
    eventType: "mfa_verification_failed",
    description: "Failed MFA verification attempt",
    severity: "warning",
  });

  return {
    success: false,
    message: "Invalid MFA token",
  };
}

/**
 * Generate backup codes
 */
function generateBackupCodes(count: number): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Get remaining backup codes count
 */
export async function getBackupCodesCount(userId: number): Promise<number> {
  const mfaSettings = await db.getUserMfaSettings(userId);
  if (!mfaSettings || !mfaSettings.backupCodes) {
    return 0;
  }
  const codes = Array.isArray(mfaSettings.backupCodes)
    ? mfaSettings.backupCodes
    : [];
  return codes.length;
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(userId: number): Promise<string[]> {
  const backupCodes = generateBackupCodes(10);

  await db.updateUserMfaSettings(userId, {
    backupCodes,
  });

  // Log audit event
  await db.createAuditLog({
    userId,
    eventType: "mfa_backup_codes_regenerated",
    description: "Backup codes regenerated",
    severity: "info",
  });

  return backupCodes;
}
