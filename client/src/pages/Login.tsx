import { useEffect, useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Server, Mail } from 'lucide-react';

// Provider icons as SVG components
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.4 11.4H1V1h10.4v10.4z" fill="#F25022"/>
    <path d="M23 11.4H12.6V1H23v10.4z" fill="#7FBA00"/>
    <path d="M11.4 23H1V12.6h10.4V23z" fill="#00A4EF"/>
    <path d="M23 23H12.6V12.6H23V23z" fill="#FFB900"/>
  </svg>
);

const AppleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

export default function Login() {
  const { user, loading, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect to home
  useEffect(() => {
    // Only redirect if user is actually logged in (not null/undefined)
    // Wait for loading to complete before checking
    if (!loading && user !== null && user !== undefined) {
      setLocation('/');
    }
  }, [user, loading, setLocation]);

  const handleProviderLogin = (provider: 'google' | 'microsoft' | 'apple') => {
    // OAuth providers still need to go through the portal
    window.location.href = getLoginUrl({ type: 'signUp', provider });
  };

  const handleEmailLogin = () => {
    if (email.trim()) {
      // For email login, call API directly without redirecting to portal
      handleEmailSubmit();
    } else {
      setShowEmailInput(true);
    }
  };

  const handleContinue = () => {
    if (email.trim()) {
      // For email login, call API directly without redirecting to portal
      handleEmailSubmit();
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      const appId = import.meta.env.VITE_APP_ID;
      const redirectUri = `${window.location.origin}/api/oauth/callback`;
      const state = btoa(redirectUri);

      const response = await fetch('/webdev.v1.WebDevAuthPublicService/Authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // IMPORTANT: Include credentials to receive cookies
        body: JSON.stringify({
          provider: 'email',
          email: email.trim(),
          redirectUri: redirectUri,
          state: state,
          appId: appId,
          type: 'signIn', // Use signIn for email (auto-register if needed)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Authentication failed');
      }

      const data = await response.json();
      console.log('[Email Login] Response:', data);

      // Check if direct login was successful
      if (data.success && data.redirectUrl) {
        // Refresh user data to get the new session
        await refresh();
        // Redirect to the specified URL (usually "/")
        window.location.href = data.redirectUrl;
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      console.error('[Email Login] Error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If already logged in, show nothing (will redirect via useEffect)
  if (user !== null && user !== undefined) {
    return null;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="w-full max-w-md mx-4">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Logo and Title */}
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Server className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sign in or sign up</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Start creating with Wukong
              </p>
            </div>
          </div>

          {/* OAuth Provider Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => handleProviderLogin('google')}
              variant="outline"
              size="lg"
              className="w-full h-12 text-base font-medium border-2 hover:bg-accent/50"
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <Button
              onClick={() => handleProviderLogin('microsoft')}
              variant="outline"
              size="lg"
              className="w-full h-12 text-base font-medium border-2 hover:bg-accent/50"
            >
              <MicrosoftIcon />
              Continue with Microsoft
            </Button>

            <Button
              onClick={() => handleProviderLogin('apple')}
              variant="outline"
              size="lg"
              className="w-full h-12 text-base font-medium border-2 hover:bg-accent/50"
            >
              <AppleIcon />
              Continue with Apple
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Email Input or Continue Button */}
          {showEmailInput ? (
            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null); // Clear error when user types
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSubmitting && email.trim()) {
                      handleContinue();
                    }
                  }}
                  className="pl-10 h-12 text-base"
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  {error}
                </div>
              )}
              <Button
                onClick={handleContinue}
                size="lg"
                className="w-full h-12 text-base font-semibold"
                disabled={!email.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleEmailLogin}
              variant="outline"
              size="lg"
              className="w-full h-12 text-base font-medium border-2 hover:bg-accent/50"
            >
              <Mail className="h-5 w-5" />
              Continue with Email
            </Button>
          )}

          {/* Footer */}
          <div className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our{' '}
              <a href="#" className="underline hover:text-foreground">Terms of service</a>
              {' '}and{' '}
              <a href="#" className="underline hover:text-foreground">Privacy policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

