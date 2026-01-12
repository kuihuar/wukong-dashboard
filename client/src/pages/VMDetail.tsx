import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Server,
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Cpu,
  HardDrive,
  Network,
  Monitor,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Camera,
  Activity,
  Terminal,
} from "lucide-react";
import { VNCConsole } from "@/components/VNCConsole";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

export default function VMDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  // All hooks must be called before any conditional returns
  const { data: vm, isLoading, refetch } = trpc.vm.get.useQuery(
    { id: id || "" },
    { enabled: !authLoading && !!user && !!id } // Only fetch when authenticated and id exists
  );
  const { data: snapshots } = trpc.snapshot.listByVM.useQuery(
    { vmId: id || "" },
    { enabled: !authLoading && !!user && !!id } // Only fetch when authenticated and id exists
  );
  
  const actionMutation = trpc.vm.action.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createSnapshotMutation = trpc.snapshot.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

  if (authLoading || !user) {
    return null; // Will redirect
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-muted/50 rounded animate-pulse" />
        <div className="h-64 bg-muted/50 rounded-xl animate-pulse" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!vm) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Server className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Virtual Machine Not Found</h2>
        <p className="text-muted-foreground mt-2">The requested VM does not exist or has been deleted.</p>
        <Button onClick={() => setLocation("/vms")} className="mt-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to VMs
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Running":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1.5 px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Running
          </Badge>
        );
      case "Stopped":
        return (
          <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 gap-1.5 px-3 py-1">
            <XCircle className="h-3.5 w-3.5" />
            Stopped
          </Badge>
        );
      case "Error":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1.5 px-3 py-1">
            <AlertCircle className="h-3.5 w-3.5" />
            Error
          </Badge>
        );
      case "Pending":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1.5 px-3 py-1">
            <Clock className="h-3.5 w-3.5" />
            Pending
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleAction = (action: "start" | "stop" | "restart" | "delete") => {
    if (action === "delete") {
      if (!confirm("Are you sure you want to delete this virtual machine?")) {
        return;
      }
      actionMutation.mutate({ id: vm.id, action }, {
        onSuccess: () => setLocation("/vms"),
      });
    } else {
      actionMutation.mutate({ id: vm.id, action });
    }
  };

  const handleCreateSnapshot = () => {
    const name = prompt("Enter snapshot name:", `${vm.name}-snapshot-${Date.now()}`);
    if (name) {
      createSnapshotMutation.mutate({ wukongId: vm.id, name });
    }
  };

  const formatChartData = (data: { timestamp: number; value: number }[]) => {
    return data.map(d => ({
      time: new Date(d.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      value: d.value,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/vms")}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{vm.name}</h1>
              {getStatusBadge(vm.status)}
            </div>
            <p className="text-muted-foreground mt-1">
              {vm.osImage} · {vm.nodeName || "Unscheduled"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {vm.status === "Stopped" && (
            <Button onClick={() => handleAction("start")} className="gap-2">
              <Play className="h-4 w-4" />
              Start
            </Button>
          )}
          {vm.status === "Running" && (
            <>
              <Button variant="outline" onClick={() => handleAction("stop")} className="gap-2">
                <Square className="h-4 w-4" />
                Stop
              </Button>
              <Button variant="outline" onClick={() => handleAction("restart")} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Restart
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleCreateSnapshot} className="gap-2">
            <Camera className="h-4 w-4" />
            Snapshot
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction("delete")}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Resource Overview - Only show metrics if VM is running */}
      {vm.metrics && vm.status === "Running" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="font-medium">CPU Usage</span>
                </div>
                <span className="text-2xl font-bold">{vm.metrics.cpuUsage}%</span>
              </div>
              <Progress value={vm.metrics.cpuUsage} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">{vm.cpu} vCPU allocated</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-chart-2" />
                  <span className="font-medium">Memory Usage</span>
                </div>
                <span className="text-2xl font-bold">{vm.metrics.memoryUsage}%</span>
              </div>
              <Progress value={vm.metrics.memoryUsage} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">{vm.memory} allocated</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-chart-3" />
                  <span className="font-medium">Disk Usage</span>
                </div>
                <span className="text-2xl font-bold">{vm.metrics.diskUsage}%</span>
              </div>
              <Progress value={vm.metrics.diskUsage} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">
                {vm.disks.reduce((sum, d) => sum + parseInt(d.size), 0)}Gi total
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  Metrics are only available when the VM is running
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start the VM to view CPU, Memory, and Disk usage
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="monitoring" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="monitoring" className="gap-2">
            <Monitor className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="network" className="gap-2">
            <Network className="h-4 w-4" />
            Network
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-2">
            <HardDrive className="h-4 w-4" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="snapshots" className="gap-2">
            <Camera className="h-4 w-4" />
            Snapshots
          </TabsTrigger>
          <TabsTrigger value="console" className="gap-2">
            <Terminal className="h-4 w-4" />
            Console
          </TabsTrigger>
        </TabsList>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="h-4 w-4 text-primary" />
                  CPU Usage (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={formatChartData(vm.metricsHistory.cpu)}>
                      <defs>
                        <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="time" stroke="var(--color-muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-popover)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-primary)"
                        fill="url(#cpuGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="h-4 w-4 text-chart-2" />
                  Memory Usage (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={formatChartData(vm.metricsHistory.memory)}>
                      <defs>
                        <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="time" stroke="var(--color-muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-popover)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-chart-2)"
                        fill="url(#memGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Network Tab */}
        <TabsContent value="network">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Network Interfaces
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {vm.networks.map((net, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Network className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{net.name}</p>
                        <p className="text-sm text-muted-foreground">{net.interface}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <code className="text-sm bg-muted/50 px-2 py-1 rounded">
                        {net.ipAddress || "Pending..."}
                      </code>
                      <p className="text-xs text-muted-foreground mt-1">{net.macAddress}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                Disks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {vm.disks.map((disk, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                        <HardDrive className="h-5 w-5 text-chart-2" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{disk.name}</p>
                          {disk.boot && (
                            <Badge variant="outline" className="text-xs">Boot</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {disk.storageClassName} · {disk.image || "Empty"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{disk.size}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* GPU Section */}
          {vm.gpus && vm.gpus.length > 0 && (
            <Card className="glass-card mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-chart-3" />
                  GPU Devices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vm.gpus.map((gpu, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                          <Monitor className="h-5 w-5 text-chart-3" />
                        </div>
                        <div>
                          <p className="font-medium">{gpu.name}</p>
                          <p className="text-sm text-muted-foreground">{gpu.deviceName}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-chart-3/10 text-chart-3 border-chart-3/30">
                        Passthrough
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Snapshots Tab */}
        <TabsContent value="snapshots">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Snapshots
              </CardTitle>
              <Button onClick={handleCreateSnapshot} size="sm" className="gap-2">
                <Camera className="h-4 w-4" />
                Create Snapshot
              </Button>
            </CardHeader>
            <CardContent>
              {!snapshots || snapshots.length === 0 ? (
                <div className="text-center py-8">
                  <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No snapshots yet</p>
                  <Button onClick={handleCreateSnapshot} variant="outline" className="mt-4 gap-2">
                    <Camera className="h-4 w-4" />
                    Create First Snapshot
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Camera className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{snapshot.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(snapshot.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{snapshot.size}</span>
                        <Badge
                          variant="outline"
                          className={
                            snapshot.status === "Succeeded"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : snapshot.status === "Creating"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                          }
                        >
                          {snapshot.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Console Tab */}
        <TabsContent value="console" className="space-y-4">
          {vm.status === "Running" ? (
            <VNCConsole vmName={vm.name} />
          ) : (
            <Card className="glass-card">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <Terminal className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Console Unavailable</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    The VNC console is only available when the virtual machine is running.
                    Start the VM to access the console.
                  </p>
                  <Button
                    onClick={() => handleAction("start")}
                    className="mt-6 gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start VM
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
