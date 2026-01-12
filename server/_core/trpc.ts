import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ENV } from "./env";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  // In development mode, allow requests even without user
  // The context should have already created a mock user if needed
  const isDevelopment = !ENV.isProduction;

  if (!ctx.user) {
    if (isDevelopment) {
      // In development, log warning but don't throw error
      // This allows protected procedures to work without authentication
      console.warn("[Auth] Development mode: Request without user, but allowing to proceed");
    } else {
      // In production, require authentication
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
  }

  return next({
    ctx: {
      ...ctx,
      // Ensure user is set (even if null in dev mode, procedures should handle it)
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const isDevelopment = !ENV.isProduction;

    // In development, allow admin access if user exists (mock user has admin role)
    if (!ctx.user) {
      if (isDevelopment) {
        console.warn("[Auth] Development mode: Admin procedure without user, but allowing to proceed");
      } else {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }
    } else if (ctx.user.role !== 'admin') {
      // Check admin role only if user exists
      if (isDevelopment) {
        console.warn("[Auth] Development mode: User is not admin, but allowing to proceed");
      } else {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
