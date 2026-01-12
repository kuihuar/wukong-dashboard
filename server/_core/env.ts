// Helper function to clean environment variable values (remove quotes and trim)
function cleanEnvValue(value: string | undefined): string {
  if (!value) return "";
  // Remove surrounding quotes (single or double) and trim whitespace
  const cleaned = value.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    return cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

// Lazy getter function to ensure environment variables are loaded before reading
function getEnvValue(key: string): string {
  return cleanEnvValue(process.env[key]) || "";
}

const nodeEnv = process.env.NODE_ENV;
const isProduction = nodeEnv === "production";

// Log NODE_ENV for debugging
console.log(`[Env] NODE_ENV="${nodeEnv}" -> isProduction=${isProduction}`);

// Use getters to ensure environment variables are read after they're loaded
export const ENV = {
  get appId() { return getEnvValue("VITE_APP_ID"); },
  get cookieSecret() { return getEnvValue("JWT_SECRET"); },
  get databaseUrl() { return getEnvValue("DATABASE_URL"); },
  get oAuthServerUrl() { return getEnvValue("OAUTH_SERVER_URL"); },
  get ownerOpenId() { return getEnvValue("OWNER_OPEN_ID"); },
  get isProduction() { return getEnvValue("NODE_ENV") === "production"; },
  get forgeApiUrl() { return getEnvValue("BUILT_IN_FORGE_API_URL"); },
  get forgeApiKey() { return getEnvValue("BUILT_IN_FORGE_API_KEY"); },
  // OAuth Provider Credentials
  get googleClientId() { return getEnvValue("GOOGLE_CLIENT_ID"); },
  get googleClientSecret() { return getEnvValue("GOOGLE_CLIENT_SECRET"); },
  get microsoftClientId() { return getEnvValue("MICROSOFT_CLIENT_ID"); },
  get microsoftClientSecret() { return getEnvValue("MICROSOFT_CLIENT_SECRET"); },
  get appleClientId() { return getEnvValue("APPLE_CLIENT_ID"); },
  get appleClientSecret() { return getEnvValue("APPLE_CLIENT_SECRET"); },
};

// // Log appId for debugging (only in development)
// // Note: This will execute when the module is loaded, but ENV.appId is now a getter
// // so it will read the value at access time, not at module load time
// if (!isProduction) {
//   // Use setTimeout to ensure this runs after index.ts loads environment variables
//   setTimeout(() => {
//     console.log(`[Env] VITE_APP_ID="${ENV.appId}" (cleaned from "${process.env.VITE_APP_ID}")`);
//     console.log(`[Env] Raw process.env.VITE_APP_ID="${process.env.VITE_APP_ID}"`);
//     console.log(`[Env] All VITE_* vars:`, Object.keys(process.env).filter(k => k.startsWith('VITE_')).map(k => `${k}=${process.env[k]}`));
//   }, 0);
// }
