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

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // In development, fallback to mock user
    if (isDevelopment) {
      console.log("[Auth] Development mode: Using mock user");
      user = await getMockUser();
    } else {
      // In production, authentication is required
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
