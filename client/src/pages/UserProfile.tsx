import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  User,
  Mail,
  Shield,
  Calendar,
  Clock,
  Key,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

export default function UserProfile() {
  const { user, loading, refresh } = useAuth();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-64 bg-muted/50 rounded-lg animate-pulse" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground py-8">
                User information not found
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Profile</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your account information
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refresh()}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-4 w-4 inline mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Profile Card */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold">
                    {user.name || 'Name not set'}
                  </h2>
                  {user.role && (
                    <Badge
                      variant="outline"
                      className={
                        user.role === 'admin'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </Badge>
                  )}
                </div>
                {user.email && (
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* User Details */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Basic Information
              </CardTitle>
              <CardDescription>Basic account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">User ID</span>
                  <span className="font-mono text-sm font-medium">
                    #{user.id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="font-medium">
                    {user.name || <span className="text-muted-foreground">Not set</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="font-medium">
                    {user.email || <span className="text-muted-foreground">Not set</span>}
                  </span>
                </div>
                {user.loginMethod && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Login Method</span>
                    <Badge variant="outline" className="text-xs">
                      {user.loginMethod}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Account Status
              </CardTitle>
              <CardDescription>Account permissions and status information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Role</span>
                  <Badge
                    variant="outline"
                    className={
                      user.role === 'admin'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }
                  >
                    {user.role === 'admin' ? 'Administrator' : 'User'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Account Status</span>
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Timestamps
              </CardTitle>
              <CardDescription>Account creation and activity times</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {user.createdAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Created At
                    </span>
                    <span className="font-medium text-sm">
                      {format(
                        user.createdAt instanceof Date 
                          ? user.createdAt 
                          : new Date(user.createdAt as string | number),
                        'yyyy-MM-dd HH:mm'
                      )}
                    </span>
                  </div>
                )}
                {user.lastSignedIn && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Last Signed In
                    </span>
                    <span className="font-medium text-sm">
                      {format(
                        user.lastSignedIn instanceof Date 
                          ? user.lastSignedIn 
                          : new Date(user.lastSignedIn as string | number),
                        'yyyy-MM-dd HH:mm'
                      )}
                    </span>
                  </div>
                )}
                {user.updatedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Updated At
                    </span>
                    <span className="font-medium text-sm">
                      {format(
                        user.updatedAt instanceof Date 
                          ? user.updatedAt 
                          : new Date(user.updatedAt as string | number),
                        'yyyy-MM-dd HH:mm'
                      )}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* OpenID Information */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Identity
              </CardTitle>
              <CardDescription>Unique identifier for the account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">OpenID</span>
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                    {user.openId}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

