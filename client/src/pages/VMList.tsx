import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import {
  Server,
  Plus,
  Search,
  MoreHorizontal,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Eye,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function VMList() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: vms, isLoading, refetch } = trpc.vm.list.useQuery();
  const actionMutation = trpc.vm.action.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const filteredVMs = vms?.filter(vm =>
    vm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vm.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vm.osImage.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Running":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            Running
          </Badge>
        );
      case "Stopped":
        return (
          <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/30 gap-1.5">
            <XCircle className="h-3 w-3" />
            Stopped
          </Badge>
        );
      case "Error":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 gap-1.5">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      case "Pending":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1.5">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5">
            {status}
          </Badge>
        );
    }
  };

  const handleAction = (id: string, action: "start" | "stop" | "restart" | "delete") => {
    if (action === "delete") {
      if (!confirm("Are you sure you want to delete this virtual machine?")) {
        return;
      }
    }
    actionMutation.mutate({ id, action });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Virtual Machines</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor your Kubernetes virtual machines
          </p>
        </div>
        <Button onClick={() => setLocation("/vms/create")} className="gap-2">
          <Plus className="h-4 w-4" />
          Create VM
        </Button>
      </div>

      {/* Search & Filters */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or OS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Server className="h-4 w-4" />
              <span>{filteredVMs.length} virtual machines</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VM Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            All Instances
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredVMs.length === 0 ? (
            <div className="text-center py-12">
              <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No virtual machines found</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery ? "Try adjusting your search query" : "Create your first virtual machine to get started"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setLocation("/vms/create")} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Create VM
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Resources</TableHead>
                    <TableHead className="font-semibold">IP Address</TableHead>
                    <TableHead className="font-semibold">Node</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="font-semibold w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVMs.map((vm) => (
                    <TableRow
                      key={vm.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setLocation(`/vms/${vm.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Server className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{vm.name}</p>
                            <p className="text-xs text-muted-foreground">{vm.osImage}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(vm.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{vm.cpu} vCPU</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{vm.memory}</span>
                          {vm.hasGpu && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <Badge variant="outline" className="text-xs bg-chart-3/10 text-chart-3 border-chart-3/30">
                                GPU
                              </Badge>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted/50 px-2 py-0.5 rounded">
                          {vm.ipAddress || "-"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {vm.nodeName || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(vm.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setLocation(`/vms/${vm.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {vm.status === "Stopped" && (
                              <DropdownMenuItem onClick={() => handleAction(vm.id, "start")}>
                                <Play className="mr-2 h-4 w-4 text-emerald-400" />
                                Start
                              </DropdownMenuItem>
                            )}
                            {vm.status === "Running" && (
                              <>
                                <DropdownMenuItem onClick={() => handleAction(vm.id, "stop")}>
                                  <Square className="mr-2 h-4 w-4 text-amber-400" />
                                  Stop
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAction(vm.id, "restart")}>
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Restart
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleAction(vm.id, "delete")}
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
    </div>
  );
}
