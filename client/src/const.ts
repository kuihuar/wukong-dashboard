export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (options?: {
  type?: "signIn" | "signUp";
  provider?: "google" | "microsoft" | "apple" | "email";
}) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  // Debug logging (only in development)
  if (import.meta.env.DEV) {
    console.log("[Login] Environment variables:", {
      VITE_OAUTH_PORTAL_URL: oauthPortalUrl,
      VITE_APP_ID: appId,
      redirectUri,
    });
  }

  // Validate required environment variables
  if (!oauthPortalUrl) {
    throw new Error("VITE_OAUTH_PORTAL_URL is not configured");
  }
  if (!appId) {
    throw new Error("VITE_APP_ID is not configured");
  }

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", options?.type || "signIn");
  
  // Add provider parameter if specified
  if (options?.provider) {
    url.searchParams.set("provider", options.provider);
  }

  return url.toString();
};
