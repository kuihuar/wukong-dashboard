/**
 * OAuth Server Service
 * Handles OAuth authorization code generation, token exchange, and user info retrieval
 */

import { randomBytes } from "crypto";
import { SignJWT } from "jose";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoRequest,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";
import * as db from "../db";
import { ENV } from "./env";

// In-memory storage for authorization codes (in production, use Redis or database)
interface AuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  userId: string;
  openId: string;
  expiresAt: number;
  used: boolean;
}

const authorizationCodes = new Map<string, AuthorizationCode>();

// In-memory storage for access tokens (in production, use Redis or database)
interface AccessToken {
  token: string;
  userId: string;
  openId: string;
  clientId: string;
  expiresAt: number;
}

const accessTokens = new Map<string, AccessToken>();

// Cleanup expired codes and tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  
  // Clean expired authorization codes
  const codesToDelete: string[] = [];
  authorizationCodes.forEach((authCode, code) => {
    if (authCode.expiresAt < now) {
      codesToDelete.push(code);
    }
  });
  codesToDelete.forEach(code => authorizationCodes.delete(code));
  
  // Clean expired access tokens
  const tokensToDelete: string[] = [];
  accessTokens.forEach((accessToken, token) => {
    if (accessToken.expiresAt < now) {
      tokensToDelete.push(token);
    }
  });
  tokensToDelete.forEach(token => accessTokens.delete(token));
}, 5 * 60 * 1000);

/**
 * Generate a random authorization code
 */
function generateAuthorizationCode(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Generate a random access token
 */
function generateAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Create and store an authorization code
 */
export async function createAuthorizationCode(
  clientId: string,
  redirectUri: string,
  userId: string,
  openId: string
): Promise<string> {
  const code = generateAuthorizationCode();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  authorizationCodes.set(code, {
    code,
    clientId,
    redirectUri,
    userId,
    openId,
    expiresAt,
    used: false,
  });

  console.log(`[OAuth Server] Created authorization code: ${code.substring(0, 10)}...`);
  console.log(`[OAuth Server] Code details: clientId="${clientId}", redirectUri="${redirectUri}", openId="${openId}"`);
  console.log(`[OAuth Server] Total codes in storage: ${authorizationCodes.size}`);

  return code;
}

/**
 * Mock authorization code for development/testing
 * Creates a temporary authorization code when the original one is not found
 */
async function mockAuthCode(
  request: ExchangeTokenRequest
): Promise<AuthorizationCode | null> {
  // Only allow in development mode
  if (ENV.isProduction) {
    return null;
  }

  console.log(`[OAuth Server] Creating mock authorization code for development...`);
  
  // Try to find a user by openId from the redirectUri or create a mock user
  // For now, create a mock user with a default openId
  const mockOpenId = "dev-user-mock";
  let user = await db.getUserByOpenId(mockOpenId);
  
  if (!user) {
    // Create mock user if not exists
    await db.upsertUser({
      openId: mockOpenId,
      name: "Development User",
      email: "dev@localhost",
      loginMethod: "mock",
      role: "admin",
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId(mockOpenId);
  }

  if (!user) {
    console.error(`[OAuth Server] Failed to create/get mock user`);
    return null;
  }

  // Create a mock authorization code using the request code as key
  const mockCode: AuthorizationCode = {
    code: request.code,
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    userId: user.id.toString(),
    openId: user.openId,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    used: false,
  };

  // Store it in the map
  authorizationCodes.set(request.code, mockCode);
  
  console.log(`[OAuth Server] Mock authorization code created: code="${request.code.substring(0, 10)}...", openId="${user.openId}"`);
  
  return mockCode;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  request: ExchangeTokenRequest
): Promise<ExchangeTokenResponse> {
  // Validate grant type
  if (request.grantType !== "authorization_code") {
    throw new Error("Invalid grant type. Only 'authorization_code' is supported.");
  }

  // Find and validate authorization code
  console.log(`[OAuth Server] Looking for authorization code: ${request.code.substring(0, 10)}...`);
  console.log(`[OAuth Server] Request details: clientId="${request.clientId}", redirectUri="${request.redirectUri}"`);
  console.log(`[OAuth Server] Total codes in storage: ${authorizationCodes.size}`);
  const codeKeys: string[] = [];
  authorizationCodes.forEach((_, key) => {
    codeKeys.push(key.substring(0, 10) + "...");
  });
  console.log(`[OAuth Server] Available codes:`, codeKeys);
  
  let authCode = authorizationCodes.get(request.code);
  console.log(`[OAuth ServerXXXX] request.code:`, request.code);
  console.log(`[OAuth ServerXXXX] authCode:`, authCode);
  
  if (!authCode) {
    console.warn(`[OAuth Server] Authorization code not found! Attempting to create mock auth code...`);
    // Mock authorization code for development/testing
    const mockCode = await mockAuthCode(request);
    if (!mockCode) {
      console.error(`[OAuth Server] Failed to create mock authorization code!`);
      throw new Error("Invalid authorization code");
    }
    authCode = mockCode;
  }
  
  console.log(`[OAuth Server] Found authorization code: clientId="${authCode.clientId}", redirectUri="${authCode.redirectUri}"`);

  if (authCode.used) {
    throw new Error("Authorization code has already been used");
  }

  if (authCode.expiresAt < Date.now()) {
    authorizationCodes.delete(request.code);
    throw new Error("Authorization code has expired");
  }

  if (authCode.clientId !== request.clientId) {
    throw new Error("Invalid client ID");
  }

  if (authCode.redirectUri !== request.redirectUri) {
    throw new Error("Redirect URI mismatch");
  }

  // Mark code as used
  authCode.used = true;

  // Generate access token
  const accessToken = generateAccessToken();
  const expiresIn = 3600; // 1 hour
  const expiresAt = Date.now() + expiresIn * 1000;

  // Store access token
  accessTokens.set(accessToken, {
    token: accessToken,
    userId: authCode.userId,
    openId: authCode.openId,
    clientId: authCode.clientId,
    expiresAt,
  });

  // Generate ID token (JWT)
  const idToken = await generateIdToken(authCode.openId, request.clientId);

  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn,
    scope: "openid profile email",
    idToken,
  };
}

/**
 * Get user info by access token
 */
export async function getUserInfoByToken(
  request: GetUserInfoRequest
): Promise<GetUserInfoResponse> {
  // Find and validate access token
  const tokenData = accessTokens.get(request.accessToken);

  if (!tokenData) {
    throw new Error("Invalid access token");
  }

  if (tokenData.expiresAt < Date.now()) {
    accessTokens.delete(request.accessToken);
    throw new Error("Access token has expired");
  }

  // Get user from database
  const user = await db.getUserByOpenId(tokenData.openId);

  if (!user) {
    throw new Error("User not found");
  }

  return {
    openId: user.openId,
    projectId: tokenData.clientId,
    name: user.name || "Unknown User",
    email: user.email ?? null,
    platform: user.loginMethod ?? null,
    loginMethod: user.loginMethod ?? null,
  };
}

/**
 * Get user info by JWT token
 */
export async function getUserInfoByJwt(
  request: GetUserInfoWithJwtRequest
): Promise<GetUserInfoWithJwtResponse> {
  // Verify JWT token
  try {
    const secretKey = new TextEncoder().encode(ENV.cookieSecret);
    const { jwtVerify } = await import("jose");
    
    const { payload } = await jwtVerify(request.jwtToken, secretKey, {
      algorithms: ["HS256"],
    });

    const openId = payload.openId as string;
    if (!openId) {
      throw new Error("Invalid JWT token: missing openId");
    }

    // Get user from database
    const user = await db.getUserByOpenId(openId);

    if (!user) {
      throw new Error("User not found");
    }

    return {
      openId: user.openId,
      projectId: request.projectId,
      name: user.name || "Unknown User",
      email: user.email ?? null,
      platform: user.loginMethod ?? null,
      loginMethod: user.loginMethod ?? null,
    };
  } catch (error) {
    throw new Error(`Invalid JWT token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate ID token (JWT)
 */
async function generateIdToken(openId: string, clientId: string): Promise<string> {
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const issuedAt = Date.now();
  const expiresIn = 3600; // 1 hour
  const expirationSeconds = Math.floor((issuedAt + expiresIn * 1000) / 1000);

  return new SignJWT({
    openId,
    clientId,
    iss: ENV.oAuthServerUrl || "http://localhost:8081", // Issuer
    aud: clientId, // Audience
    sub: openId, // Subject
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(Math.floor(issuedAt / 1000))
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

/**
 * Get or create user by provider authentication
 * This is called when user authenticates via OAuth provider (Google, Microsoft, Apple, Email)
 */
export async function getOrCreateUserByProvider(
  provider: "google" | "microsoft" | "apple" | "email",
  providerUserId: string,
  userInfo: {
    name?: string;
    email?: string;
  }
): Promise<{ userId: string; openId: string }> {
  // Generate openId from provider and providerUserId
  // Format: {provider}:{providerUserId}
  const openId = `${provider}:${providerUserId}`;

  // Try to get existing user
  let user = await db.getUserByOpenId(openId);

  if (!user) {
    // Create new user
    await db.upsertUser({
      openId,
      name: userInfo.name || null,
      email: userInfo.email || null,
      loginMethod: provider,
      lastSignedIn: new Date(),
    });

    user = await db.getUserByOpenId(openId);

    if (!user) {
      throw new Error("Failed to create user");
    }
  } else {
    // Update last signed in time
    await db.upsertUser({
      openId,
      lastSignedIn: new Date(),
    });
  }

  return {
    userId: user.id.toString(),
    openId: user.openId,
  };
}

