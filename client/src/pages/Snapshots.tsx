import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera,
  Search,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Server,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Snapshots() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedVM, setSelectedVM] = useState("");
  const [snapshotName, setSnapshotName] = useState("");

  // All hooks must be called before any conditional returns
  const { data: snapshots, isLoading, refetch } = trpc.snapshot.list.useQuery(undefined, {
    enabled: !loading && !!user, // Only fetch when authenticated
  });
  const { data: vms } = trpc.vm.list.useQuery(undefined, {
    enabled: !loading && !!user, // Only fetch when authenticated
  });

  const createMutation = trpc.snapshot.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setCreateDialogOpen(false);
      setSelectedVM("");
      setSnapshotName("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const restoreMutation = trpc.snapshot.restore.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.snapshot.delete.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation('/login');
    }
  }, [user, loading, setLocation]);

  if (loading || !user) {
    return null; // Will redirect
  }

  const filteredSnapshots = snapshots?.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.wukongName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Succeeded":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            Succeeded
          </Badge>
        );
      case "Creating":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1.5">
            <Clock className="h-3 w-3" />
            Creating
          </Badge>
        );
      case "Failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 gap-1.5">
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleRestore = (snapshotId: string) => {
    if (confirm("Are you sure you want to restore from this snapshot? This will overwrite the current VM state.")) {
      restoreMutation.mutate({ snapshotId });
    }
  };

  const handleDelete = (snapshotId: string) => {
    if (confirm("Are you sure you want to delete this snapshot?")) {
      deleteMutation.mutate({ snapshotId });
    }
  };

  const handleCreate = () => {
    if (!selectedVM || !snapshotName.trim()) {
      toast.error("Please select a VM and enter a snapshot name");
      return;
    }
    createMutation.mutate({ wukongId: selectedVM, name: snapshotName.trim() });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Snapshots</h1>
          <p className="text-muted-foreground mt-1">
            Manage virtual machine snapshots and backups
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Snapshot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Snapshot</DialogTitle>
              <DialogDescription>
                Create a point-in-time snapshot of a virtual machine
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Virtual Machine</Label>
                <Select value={selectedVM} onValueChange={setSelectedVM}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a VM" />
                  </SelectTrigger>
                  <SelectContent>
                    {vms?.filter(vm => vm.status === "Running" || vm.status === "Stopped").map((vm) => (
                      <SelectItem key={vm.id} value={vm.id}>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4" />
                          {vm.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Snapshot Name</Label>
                <Input
                  placeholder="my-snapshot-001"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or VM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Camera className="h-4 w-4" />
              <span>{filteredSnapshots.length} snapshots</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Snapshots Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            All Snapshots
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredSnapshots.length === 0 ? (
            <div className="text-center py-12">
              <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No snapshots found</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery ? "Try adjusting your search query" : "Create your first snapshot to protect your VMs"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setCreateDialogOpen(true)} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Create Snapshot
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">Snapshot</TableHead>
                    <TableHead className="font-semibold">Virtual Machine</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Size</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="font-semibold w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSnapshots.map((snapshot) => (
                    <TableRow key={snapshot.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Camera className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{snapshot.name}</p>
                            <p className="text-xs text-muted-foreground">{snapshot.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setLocation(`/vms/${snapshot.wukongId}`)}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          <Server className="h-4 w-4" />
                          {snapshot.wukongName}
                        </button>
                      </TableCell>
                      <TableCell>{getStatusBadge(snapshot.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm">{snapshot.size}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{formatRelativeTime(snapshot.createdAt)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(snapshot.createdAt)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => handleRestore(snapshot.id)}
                              disabled={snapshot.status !== "Succeeded"}
                            >
                              <RotateCcw className="mr-2 h-4 w-4 text-primary" />
                              Restore
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(snapshot.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {snapshots?.filter(s => s.status === "Succeeded").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Successful Snapshots</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {snapshots?.filter(s => s.status === "Creating").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {snapshots?.reduce((sum, s) => sum + parseInt(s.size) || 0, 0) || 0} Gi
                </p>
                <p className="text-sm text-muted-foreground">Total Storage Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
