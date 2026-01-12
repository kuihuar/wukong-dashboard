import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    console.log(`[OAuth Callback] Received code: ${code?.substring(0, 20)}..., state: ${state?.substring(0, 20)}...`);
    console.log(`[OAuth Callback] Full URL: ${req.url}`);
    console.log(`[OAuth Callback] Raw state value:`, JSON.stringify(state));
    console.log(`[OAuth Callback] State length:`, state?.length);
    console.log(`[OAuth Callback] State bytes:`, state ? Array.from(state).map(c => c.charCodeAt(0)).join(',') : 'null');
    // Try to decode state to see what it contains
    if (state) {
      try {
        const decoded = atob(state);
        console.log(`[OAuth Callback] Decoded state (direct atob):`, JSON.stringify(decoded));
      } catch (e) {
        console.log(`[OAuth Callback] Direct atob failed:`, e);
        try {
          const urlDecoded = decodeURIComponent(state);
          console.log(`[OAuth Callback] URL-decoded state:`, JSON.stringify(urlDecoded));
          const decoded = atob(urlDecoded);
          console.log(`[OAuth Callback] Decoded state (URL+atob):`, JSON.stringify(decoded));
        } catch (e2) {
          console.log(`[OAuth Callback] URL+atob also failed:`, e2);
        }
      }
    }

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      console.log(`[OAuth Callback] Calling exchangeCodeForToken with code: ${code.substring(0, 20)}...`);
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
