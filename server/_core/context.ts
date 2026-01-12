import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Create a mock user for development
async function getMockUser(): Promise<User | null> {
  const mockOpenId = "dev-user-mock";
  
  try {
    // Try to get existing mock user
    let user = await db.getUserByOpenId(mockOpenId);
    
    // If not exists, create one
    if (!user) {
      await db.upsertUser({
        openId: mockOpenId,
        name: "Development User",
        email: "dev@localhost",
        loginMethod: "mock",
        role: "admin", // Give admin role for development
        lastSignedIn: new Date(),
      });
      user = await db.getUserByOpenId(mockOpenId);
    }
    
    return user;
  } catch (error) {
    console.warn("[Auth] Failed to create mock user:", error);
    return null;
  }
  
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // In development mode, use mock user if authentication fails
  const isDevelopment = !ENV.isProduction;
  console.log("[Auth] createContext: isDevelopment =", isDevelopment);
  console.log("[Auth] createContext: cookie header =", opts.req.headers.cookie ? "present" : "missing");
  
  try {
    user = await sdk.authenticateRequest(opts.req);
    console.log("[Auth] createContext: authentication successful, user =", user ? `${user.id}:${user.email}` : "null");
  } catch (error) {
    console.error("[Auth] createContext: authentication failed:", error);
    // In development, fallback to mock user
    if (isDevelopment) {
      console.log("[Auth] Development mode: Authentication failed, user = null");
      // Note: Mock user is disabled, so user remains null
      //user = await getMockUser();
    } else {
      // In production, authentication is required
      console.log("[Auth] Production mode: Authentication required, user = null");
      user = null;
    }
  }

  console.log("[Auth] createContext: final user =", user ? `${user.id}:${user.email}` : "null");
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
