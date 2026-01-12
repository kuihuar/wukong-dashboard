import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Server, Cpu, HardDrive, Activity, AlertCircle, CheckCircle2, Clock, XCircle, Plus, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  
  // All hooks must be called before any conditional returns
  const { data: stats, isLoading: statsLoading } = trpc.vm.stats.useQuery(undefined, {
    enabled: !loading && !!user, // Only fetch when authenticated
  });
  const { data: vms, isLoading: vmsLoading } = trpc.vm.list.useQuery(undefined, {
    enabled: !loading && !!user, // Only fetch when authenticated
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    // Only redirect if loading is complete and user is definitely not logged in
    if (!loading && user === null) {
      setLocation('/login');
    }
  }, [user, loading, setLocation]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return null; // Will redirect via useEffect
  }

  const recentVMs = vms?.slice(0, 4) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Running":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "Stopped":
        return <XCircle className="h-4 w-4 text-zinc-500" />;
      case "Error":
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case "Pending":
        return <Clock className="h-4 w-4 text-amber-400" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your Kubernetes virtual machine infrastructure
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total VMs</CardTitle>
            <Server className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {statsLoading ? "..." : stats?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Managed instances
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Running</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">
              {statsLoading ? "..." : stats?.running || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active instances
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total CPU</CardTitle>
            <Cpu className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {statsLoading ? "..." : stats?.totalCpu || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Allocated cores
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Memory</CardTitle>
            <HardDrive className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {statsLoading ? "..." : stats?.totalMemory || "0Gi"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Allocated memory
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.running || 0}</p>
                <p className="text-sm text-muted-foreground">Running</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-500/10 border-zinc-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-500/20 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-zinc-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.stopped || 0}</p>
                <p className="text-sm text-muted-foreground">Stopped</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.error || 0}</p>
                <p className="text-sm text-muted-foreground">Error</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent VMs & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent VMs */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Virtual Machines</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/vms")}>
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {vmsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {recentVMs.map(vm => (
                  <div
                    key={vm.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/vms/${vm.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Server className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{vm.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {vm.cpu} vCPU · {vm.memory} · {vm.osImage}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(vm.status)}
                      <span className={`text-sm ${
                        vm.status === "Running" ? "text-emerald-400" :
                        vm.status === "Stopped" ? "text-zinc-500" :
                        vm.status === "Error" ? "text-red-400" :
                        "text-amber-400"
                      }`}>
                        {vm.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full justify-start gap-3"
              onClick={() => setLocation("/vms/create")}
            >
              <Plus className="h-4 w-4" />
              Create New VM
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => setLocation("/vms")}
            >
              <Server className="h-4 w-4" />
              Manage VMs
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => setLocation("/snapshots")}
            >
              <Activity className="h-4 w-4" />
              View Snapshots
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
