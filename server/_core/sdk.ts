import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    // Delay logging until first use to ensure env vars are loaded
    // The actual initialization happens lazily
  }

  private logInitialization() {
    // Only log once, and only if not already logged
    if (!(this as any)._logged) {
      const actualBaseURL = (this.client.defaults.baseURL as string) || "not set";
      console.log("[OAuth] Initialized with baseURL:", actualBaseURL);
      console.log("[OAuth] ENV.oAuthServerUrl:", ENV.oAuthServerUrl || "not set");
      if (!actualBaseURL || actualBaseURL === "not set") {
        console.error(
          "[OAuth] ERROR: baseURL is not configured! Set OAUTH_SERVER_URL environment variable."
        );
      }
      (this as any)._logged = true;
    }
  }

  private decodeState(state: string): string {
    console.log(`[OAuth] Decoding state: "${state}" (length: ${state.length})`);
    console.log(`[OAuth] State bytes:`, Array.from(state).map(c => c.charCodeAt(0)).join(','));
    console.log(`[OAuth] State is valid base64?`, /^[A-Za-z0-9+/=]+$/.test(state));
    
    try {
      // Express already URL-decodes query parameters, so state should be the raw base64 string
      // But base64 strings may contain +, /, = which might be URL-encoded
      // Try direct base64 decode first
      let redirectUri = atob(state);
      console.log(`[OAuth] Decoded redirectUri (direct): "${redirectUri}"`);
      return redirectUri;
    } catch (error) {
      // If direct decode fails, try URL decoding first (in case it was double-encoded)
      console.warn(`[OAuth] Direct base64 decode failed, trying URL decode first:`, error);
      try {
        const urlDecoded = decodeURIComponent(state);
        console.log(`[OAuth] URL-decoded state: "${urlDecoded}" (length: ${urlDecoded.length})`);
        console.log(`[OAuth] URL-decoded state bytes:`, Array.from(urlDecoded).map(c => c.charCodeAt(0)).join(','));
        const redirectUri = atob(urlDecoded);
        console.log(`[OAuth] Decoded redirectUri (URL+base64): "${redirectUri}"`);
        return redirectUri;
      } catch (e) {
        console.error(`[OAuth] Failed to decode state:`, e);
        console.error(`[OAuth] State value:`, JSON.stringify(state));
        console.error(`[OAuth] State hex:`, Array.from(state).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
        throw new Error(`Invalid state parameter: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    this.logInitialization();
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const baseURL = this.client.defaults.baseURL as string;
    const fullUrl = baseURL ? `${baseURL}${EXCHANGE_TOKEN_PATH}` : EXCHANGE_TOKEN_PATH;
    console.log("[OAuth] Requesting token from:", fullUrl);
    console.log("[OAuth] Payload:", JSON.stringify(payload, null, 2));

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  async getUserInfoByToken(
    token: ExchangeTokenResponse
  ): Promise<GetUserInfoResponse> {
    this.logInitialization();
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance => {
  // If OAUTH_SERVER_URL is not set, use the current server (for integrated OAuth server)
  // Default to localhost:3000, or use PORT from environment
  let baseURL = ENV.oAuthServerUrl;
  if (!baseURL) {
    const port = process.env.PORT || "3000";
    baseURL = `http://localhost:${port}`;
    console.log(`[OAuth] OAUTH_SERVER_URL not set, using default: ${baseURL}`);
  }
  
  return axios.create({
    baseURL,
    timeout: AXIOS_TIMEOUT_MS,
  });
};

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      console.log("[Auth] parseCookies: no cookie header");
      return new Map<string, string>();
    }

    console.log("[Auth] parseCookies: raw cookie header =", cookieHeader.substring(0, 200));
    const parsed = parseCookieHeader(cookieHeader);
    console.log("[Auth] parseCookies: parsed cookies =", Object.keys(parsed));
    console.log("[Auth] parseCookies: looking for COOKIE_NAME =", COOKIE_NAME);
    const cookieMap = new Map(Object.entries(parsed));
    console.log("[Auth] parseCookies: cookie map has", COOKIE_NAME, "=", cookieMap.has(COOKIE_NAME));
    return cookieMap;
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      console.log("[Auth] Verifying session with secret key length:", secretKey.length);
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      console.log("[Auth] JWT verified, payload:", { openId: payload.openId, appId: payload.appId, name: payload.name });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields", { openId, appId, name });
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      console.error("[Auth] Session verification failed", error);
      console.error("[Auth] Error details:", error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  async authenticateRequest(req: Request): Promise<User> {
    // Regular authentication flow
    console.log("[Auth] authenticateRequest: checking cookies...");
    console.log("[Auth] Cookie header:", req.headers.cookie ? "present" : "missing");
    
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    
    console.log("[Auth] Session cookie found:", sessionCookie ? "yes" : "no");
    if (sessionCookie) {
      console.log("[Auth] Session cookie length:", sessionCookie.length);
      console.log("[Auth] Session cookie preview:", sessionCookie.substring(0, 50) + "...");
    }
    
    const session = await this.verifySession(sessionCookie);
    console.log("[Auth] Session verified:", session ? "yes" : "no");
    if (session) {
      console.log("[Auth] Session openId:", session.openId);
    }

    if (!session) {
      console.error("[Auth] Session verification failed - throwing error");
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    console.log("[Auth] Looking up user by openId:", sessionUserId);
    let user = await db.getUserByOpenId(sessionUserId);
    console.log("[Auth] User found in DB:", user ? "yes" : "no");

    // If user not in DB, sync from OAuth server automatically
    if (!user) {
      console.log("[Auth] User not in DB, attempting to sync from OAuth server...");
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        console.log("[Auth] User info from OAuth server:", userInfo.openId);
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.openId);
        console.log("[Auth] User synced and retrieved:", user ? "yes" : "no");
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user) {
      console.error("[Auth] User not found after all attempts");
      throw ForbiddenError("User not found");
    }

    console.log("[Auth] Authentication successful for user:", user.id, user.email);
    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
