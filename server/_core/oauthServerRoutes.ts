/**
 * OAuth Server Routes
 * Registers OAuth server endpoints (login portal, token exchange, user info)
 */

import type { Express, Request, Response } from "express";
import {
  createAuthorizationCode,
  exchangeCodeForToken,
  getUserInfoByToken,
  getUserInfoByJwt,
  getOrCreateUserByProvider,
} from "./oauthServer";
import type {
  ExchangeTokenRequest,
  GetUserInfoRequest,
  GetUserInfoWithJwtRequest,
} from "./types/manusTypes";
import { ENV } from "./env";
import * as db from "../db";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

/**
 * Render login page HTML
 */
function renderLoginPage(options: {
  appId: string;
  redirectUri: string;
  state: string;
  type: string;
  provider?: string;
  googleClientId?: string;
  microsoftClientId?: string;
  appleClientId?: string;
}): string {
  const { appId, redirectUri, state, type, provider, googleClientId, microsoftClientId, appleClientId } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in or sign up</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      padding: 48px;
      max-width: 420px;
      width: 100%;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 8px;
    }
    .subtitle {
      text-align: center;
      color: #666;
      font-size: 14px;
      margin-bottom: 32px;
    }
    .provider-btn {
      width: 100%;
      padding: 12px 16px;
      margin-bottom: 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      background: white;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .provider-btn:hover {
      background: #f9fafb;
      border-color: #d1d5db;
    }
    .divider {
      margin: 24px 0;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
      position: relative;
    }
    .divider::before,
    .divider::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 45%;
      height: 1px;
      background: #e5e7eb;
    }
    .divider::before { left: 0; }
    .divider::after { right: 0; }
    .email-form {
      display: none;
      margin-top: 16px;
    }
    .email-form.active { display: block; }
    .email-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 15px;
      margin-bottom: 12px;
    }
    .email-input:focus {
      outline: none;
      border-color: #3b82f6;
    }
    .continue-btn {
      width: 100%;
      padding: 12px 16px;
      background: #1a1a1a;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
    }
    .continue-btn:hover {
      background: #333;
    }
    .continue-btn:disabled {
      background: #d1d5db;
      cursor: not-allowed;
    }
    .email-error {
      display: none;
      margin-top: 8px;
      padding: 8px 12px;
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 6px;
      color: #c33;
      font-size: 13px;
    }
    .footer {
      margin-top: 24px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sign in or sign up</h1>
    <p class="subtitle">Start creating with Wukong</p>
    
    <button class="provider-btn" onclick="handleProviderLogin('google')">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </button>
    
    <button class="provider-btn" onclick="handleProviderLogin('microsoft')">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#F25022" d="M11.4 11.4H1V1h10.4v10.4z"/>
        <path fill="#7FBA00" d="M23 11.4H12.6V1H23v10.4z"/>
        <path fill="#00A4EF" d="M11.4 23H1V12.6h10.4V23z"/>
        <path fill="#FFB900" d="M23 23H12.6V12.6H23V23z"/>
      </svg>
      Continue with Microsoft
    </button>
    
    <button class="provider-btn" onclick="handleProviderLogin('apple')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
      Continue with Apple
    </button>
    
    <div class="divider">Or</div>
    
    <button class="provider-btn" onclick="showEmailForm()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
      Continue with Email
    </button>
    
    <div class="email-form" id="emailForm">
      <input type="email" class="email-input" id="emailInput" placeholder="Enter your email" autofocus>
      <button class="continue-btn" id="emailContinueBtn" onclick="handleEmailLogin()">Continue</button>
    </div>
    
    <div class="footer">
      By continuing, you agree to our <a href="#">Terms of service</a> and <a href="#">Privacy policy</a>
    </div>
  </div>
  
  <script>
    const appId = ${JSON.stringify(appId)};
    const redirectUri = ${JSON.stringify(redirectUri)};
    const state = ${JSON.stringify(state)};
    const type = ${JSON.stringify(type)};
    const provider = ${JSON.stringify(provider || null)};
    
    function handleProviderLogin(providerType) {
      // Redirect to OAuth provider authorization page
      // The callback will be handled by /api/oauth/[provider]/callback
      const callbackUrl = window.location.origin + '/api/oauth/' + String(providerType) + '/callback';
      const oauthState = btoa(JSON.stringify({
        redirectUri: redirectUri,
        state: state,
        appId: appId
      }));
      
      // Build OAuth provider authorization URL
      let authUrl = '';
      if (providerType === 'google') {
        const clientId = ${JSON.stringify(googleClientId || '')};
        if (!clientId) {
          alert('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID environment variable.');
          return;
        }
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: callbackUrl,
          response_type: 'code',
          scope: 'openid profile email',
          state: oauthState,
          access_type: 'offline',
          prompt: 'consent'
        });
        authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
      } else if (providerType === 'microsoft') {
        const clientId = ${JSON.stringify(microsoftClientId || '')};
        if (!clientId) {
          alert('Microsoft OAuth is not configured. Please set MICROSOFT_CLIENT_ID environment variable.');
          return;
        }
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: callbackUrl,
          response_type: 'code',
          scope: 'openid profile email',
          state: oauthState,
          response_mode: 'query'
        });
        authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + params.toString();
      } else if (providerType === 'apple') {
        const clientId = ${JSON.stringify(appleClientId || '')};
        if (!clientId) {
          alert('Apple OAuth is not configured. Please set APPLE_CLIENT_ID environment variable.');
          return;
        }
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: callbackUrl,
          response_type: 'code',
          scope: 'openid name email',
          state: oauthState,
          response_mode: 'form_post'
        });
        authUrl = 'https://appleid.apple.com/auth/authorize?' + params.toString();
      } else {
        alert('Unsupported OAuth provider: ' + String(providerType));
        return;
      }
      
      // Redirect to OAuth provider
      window.location.href = authUrl;
    }
    
    function showEmailForm() {
      document.getElementById('emailForm').classList.add('active');
      document.getElementById('emailInput').focus();
    }
    
    function validateEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }
    
    function handleEmailLogin() {
      const emailInput = document.getElementById('emailInput');
      const continueBtn = document.getElementById('emailContinueBtn');
      const email = emailInput.value.trim();
      
      // Clear previous error
      const errorMsg = document.getElementById('emailError');
      if (errorMsg) {
        errorMsg.textContent = '';
        errorMsg.style.display = 'none';
      }
      
      // Validate email
      if (!email) {
        showEmailError('Please enter your email address');
        return;
      }
      
      if (!validateEmail(email)) {
        showEmailError('Please enter a valid email address');
        return;
      }
      
      // Disable button and show loading
      continueBtn.disabled = true;
      continueBtn.textContent = 'Processing...';
      
      // Create user and authorization code
      fetch('/webdev.v1.WebDevAuthPublicService/Authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // IMPORTANT: Include credentials to receive cookies
        body: JSON.stringify({
          provider: 'email',
          email: email,
          redirectUri: redirectUri,
          state: state,
          appId: appId,
          type: type, // Pass type (signIn or signUp)
        }),
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => { throw err; });
        }
        return res.json();
      })
      .then(data => {
        console.log('[Email Login] Response:', data);
        // Check if direct login was successful (email login always uses direct login)
        if (data.success && data.redirectUrl) {
          // Direct login: session token already set via cookie, just redirect
          console.log('[Email Login] Direct login successful, redirecting to:', data.redirectUrl);
          window.location.href = data.redirectUrl;
        } else if (data.code) {
          // This should not happen for email login, but handle it just in case
          console.warn('[Email Login] Received authorization code (unexpected for email login)');
          window.location.href = redirectUri + '?code=' + encodeURIComponent(data.code) + '&state=' + encodeURIComponent(state);
        } else {
          throw new Error('No authorization code or redirect URL received');
        }
      })
      .catch(err => {
        console.error('Authentication error:', err);
        const errorMessage = err.message || err.error || 'Authentication failed. Please try again.';
        showEmailError(errorMessage);
        continueBtn.disabled = false;
        continueBtn.textContent = 'Continue';
      });
    }
    
    function showEmailError(message) {
      let errorMsg = document.getElementById('emailError');
      if (!errorMsg) {
        errorMsg = document.createElement('div');
        errorMsg.id = 'emailError';
        errorMsg.className = 'email-error';
        const emailForm = document.getElementById('emailForm');
        emailForm.appendChild(errorMsg);
      }
      errorMsg.textContent = message;
      errorMsg.style.display = 'block';
    }
    
    // Handle Enter key in email input
    document.addEventListener('DOMContentLoaded', function() {
      const emailInput = document.getElementById('emailInput');
      if (emailInput) {
        emailInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            handleEmailLogin();
          }
        });
      }
      
      // Auto-show email form if provider is email
      if (${JSON.stringify(provider === 'email')}) {
        showEmailForm();
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Register OAuth server routes
 */
export function registerOAuthServerRoutes(app: Express) {
  // Login portal page
  app.get("/portal/app-auth", async (req: Request, res: Response) => {
    const appId = req.query.appId as string;
    const redirectUri = req.query.redirectUri as string;
    const state = req.query.state as string;
    const type = (req.query.type as string) || "signIn";
    const provider = req.query.provider as string | undefined;

    // Validate required parameters
    if (!appId || !redirectUri || !state) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "appId, redirectUri, and state are required",
      });
    }

    // Verify appId matches configured appId
    // Trim whitespace and remove quotes if present
    const receivedAppId = appId?.trim().replace(/^["']|["']$/g, '');
    const configuredAppId = ENV.appId?.trim().replace(/^["']|["']$/g, '');
    
    console.error(`[XXXXXX] receivedAppId ID: ="${receivedAppId}" , configuredAppId="${configuredAppId}"`);

    if (receivedAppId !== configuredAppId) {
      console.error(`[OAuth Server] App ID mismatch: received="${receivedAppId}" (original="${appId}"), configured="${configuredAppId}" (original="${ENV.appId}")`);
      return res.status(403).json({
        error: "Invalid app ID",
        message: "The provided app ID does not match the configured app ID",
      });
    }

    // Render login page with OAuth provider credentials
    const html = renderLoginPage({
      appId,
      redirectUri,
      state,
      type,
      provider,
      googleClientId: ENV.googleClientId,
      microsoftClientId: ENV.microsoftClientId,
      appleClientId: ENV.appleClientId,
    });

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });

  // Authenticate endpoint (handles provider authentication and creates authorization code)
  app.post("/webdev.v1.WebDevAuthPublicService/Authenticate", async (req: Request, res: Response) => {
    try {
      const { provider, providerUserId, email, redirectUri, state, appId: clientId, type } = req.body;

      if (!provider || !redirectUri || !state || !clientId) {
        return res.status(400).json({
          error: "Missing required parameters",
        });
      }

      // Verify clientId matches configured appId
      const receivedClientId = clientId?.trim().replace(/^["']|["']$/g, '');
      const configuredAppId = ENV.appId?.trim().replace(/^["']|["']$/g, '');
      
      if (receivedClientId !== configuredAppId) {
        console.error(`[OAuth Server] Client ID mismatch: received="${receivedClientId}" (original="${clientId}"), configured="${configuredAppId}" (original="${ENV.appId}")`);
        return res.status(403).json({
          error: "Invalid app ID",
        });
      }

      // For demo purposes, create a mock user
      // In production, integrate with actual OAuth providers (Google, Microsoft, Apple)
      let openId: string;
      let userInfo: { name?: string; email?: string };

      if (provider === "email") {
        if (!email) {
          return res.status(400).json({ error: "Email is required for email authentication" });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: "Invalid email format" });
        }
        
        // For email authentication, we allow auto-registration:
        // - If user exists, they sign in (regardless of type parameter)
        // - If user doesn't exist, we create a new account (auto-register)
        // This is more user-friendly than requiring separate sign-up/sign-in
        const existingUser = await db.getUserByEmail(email);
        
        // Create or get user from email
        // getOrCreateUserByProvider will create if not exists, or return existing user
        const result = await getOrCreateUserByProvider("email", email, { 
          email, 
          name: email.split("@")[0] 
        });
        
        console.log(`[OAuth Server] Email auth: ${existingUser ? 'Sign in' : 'Auto-registered'} user with email: ${email}`);
        openId = result.openId;
        
        // Get user info
        const user = await db.getUserByOpenId(openId);
        if (!user) {
          return res.status(500).json({ error: "Failed to get or create user" });
        }
        
        userInfo = { 
          email: user.email || email, 
          name: user.name || email.split("@")[0] 
        };
        
        // For email login, we ALWAYS directly create session token and skip authorization code flow
        // Email authentication doesn't need OAuth flow - it's a direct authentication
        console.log(`[OAuth Server] Email login: creating direct session token for email: ${email}`);
        
        // Create session token directly
        const sessionToken = await sdk.createSessionToken(openId, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
        });
        
        // Set cookie directly
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        
        // Return success with redirect URL (decode state to get redirectUri)
        // For email login, we should redirect to the frontend root, not to /api/oauth/callback
        // The state parameter contains the redirectUri (which is /api/oauth/callback), but we want to go to the frontend root instead
        let redirectUrl = "/";
        try {
          const decodedState = atob(decodeURIComponent(state));
          console.log(`[OAuth Server] Decoded state for email login: "${decodedState}"`);
          // The decoded state is the redirectUri (e.g., /api/oauth/callback)
          // But for email login, we want to redirect to the frontend root, not the callback
          // So we ignore the decoded state and use "/" instead
          redirectUrl = "/";
        } catch (e) {
          console.warn(`[OAuth Server] Failed to decode state, using default redirect: ${e}`);
          redirectUrl = "/";
        }
        
        console.log(`[OAuth Server] Email login response: success=true, redirectUrl="${redirectUrl}"`);
        
        // For email login, always return direct login success (no authorization code needed)
        return res.json({ 
          success: true,
          redirectUrl: redirectUrl,
          message: existingUser ? "Sign in successful" : "Registration and login successful"
        });
      } else {
        // For OAuth providers, generate a mock userId
        const id = providerUserId || `${provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const result = await getOrCreateUserByProvider(
          provider as "google" | "microsoft" | "apple",
          id,
          { name: `${provider} User`, email: `${id}@${provider}.example.com` }
        );
        openId = result.openId;
        userInfo = { name: `${provider} User`, email: `${id}@${provider}.example.com` };
      }

      // Get user to get userId
      const user = await db.getUserByOpenId(openId);
      if (!user) {
        return res.status(500).json({ error: "Failed to get or create user" });
      }

      // Create authorization code
      console.log(`[OAuth Server] Creating authorization code for: clientId="${clientId}", redirectUri="${redirectUri}", openId="${openId}"`);
      const code = await createAuthorizationCode(clientId, redirectUri, user.id.toString(), openId);
      console.log(`[OAuth Server] Authorization code created: ${code}`);

      res.json({ code });
    } catch (error) {
      console.error("[OAuth Server] Authenticate error:", error);
      res.status(500).json({
        error: "Authentication failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Exchange authorization code for token
  app.post("/webdev.v1.WebDevAuthPublicService/ExchangeToken", async (req: Request, res: Response) => {
    try {
      const request = req.body as ExchangeTokenRequest;

      console.log(`[OAuth Server] ExchangeToken request received: code="${request.code?.substring(0, 20)}...", clientId="${request.clientId}", redirectUri="${request.redirectUri}"`);

      if (!request.code || !request.clientId || !request.redirectUri) {
        return res.status(400).json({
          error: "Missing required parameters",
          message: "code, clientId, and redirectUri are required",
        });
      }

      // Verify clientId matches configured appId
      const receivedClientId = request.clientId?.trim().replace(/^["']|["']$/g, '');
      const configuredAppId = ENV.appId?.trim().replace(/^["']|["']$/g, '');
      
      if (receivedClientId !== configuredAppId) {
        console.error(`[OAuth Server] ExchangeToken Client ID mismatch: received="${receivedClientId}" (original="${request.clientId}"), configured="${configuredAppId}" (original="${ENV.appId}")`);
        return res.status(403).json({
          error: "Invalid client ID",
        });
      }

      const tokenResponse = await exchangeCodeForToken(request);

      res.json(tokenResponse);
    } catch (error) {
      console.error("[OAuth Server] ExchangeToken error:", error);
      res.status(400).json({
        error: "Token exchange failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get user info by access token
  app.post("/webdev.v1.WebDevAuthPublicService/GetUserInfo", async (req: Request, res: Response) => {
    try {
      const request = req.body as GetUserInfoRequest;

      if (!request.accessToken) {
        return res.status(400).json({
          error: "Missing required parameter",
          message: "accessToken is required",
        });
      }

      const userInfo = await getUserInfoByToken(request);

      res.json(userInfo);
    } catch (error) {
      console.error("[OAuth Server] GetUserInfo error:", error);
      res.status(401).json({
        error: "Failed to get user info",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get user info by JWT token (optional)
  app.post("/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt", async (req: Request, res: Response) => {
    try {
      const request = req.body as GetUserInfoWithJwtRequest;

      if (!request.jwtToken || !request.projectId) {
        return res.status(400).json({
          error: "Missing required parameters",
          message: "jwtToken and projectId are required",
        });
      }

      // Verify projectId matches configured appId
      const receivedProjectId = request.projectId?.trim().replace(/^["']|["']$/g, '');
      const configuredAppId = ENV.appId?.trim().replace(/^["']|["']$/g, '');
      
      if (receivedProjectId !== configuredAppId) {
        console.error(`[OAuth Server] GetUserInfoWithJwt Project ID mismatch: received="${receivedProjectId}" (original="${request.projectId}"), configured="${configuredAppId}" (original="${ENV.appId}")`);
        return res.status(403).json({
          error: "Invalid project ID",
        });
      }

      const userInfo = await getUserInfoByJwt(request);

      res.json(userInfo);
    } catch (error) {
      console.error("[OAuth Server] GetUserInfoWithJwt error:", error);
      res.status(401).json({
        error: "Failed to get user info",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

