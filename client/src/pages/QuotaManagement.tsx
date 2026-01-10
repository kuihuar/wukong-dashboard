import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Server, 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Layers, 
  Camera,
  Settings,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
  FolderKanban
} from "lucide-react";

interface QuotaCardProps {
  title: string;
  icon: React.ReactNode;
  used: number;
  limit: number;
  unit: string;
  color: string;
}

function QuotaCard({ title, icon, used, limit, unit, color }: QuotaCardProps) {
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;
  
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${color}`}>
              {icon}
            </div>
            <span className="font-medium text-sm">{title}</span>
          </div>
          {isCritical ? (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Critical
            </Badge>
          ) : isWarning ? (
            <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Warning
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              OK
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Usage</span>
            <span className="font-mono">
              {used} / {limit} {unit}
            </span>
          </div>
          <Progress 
            value={percentage} 
            className={`h-2 ${isCritical ? '[&>div]:bg-red-500' : isWarning ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
          />
          <div className="text-right text-xs text-muted-foreground">
            {percentage.toFixed(1)}% used
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface EditQuotaDialogProps {
  projectId: number;
  projectName: string;
  currentQuota: {
    maxVMs: number;
    maxCPU: number;
    maxMemoryGB: number;
    maxStorageGB: number;
    maxGPUs: number;
    maxSnapshots: number;
    enabled: boolean;
  };
  onClose: () => void;
}

function EditQuotaDialog({ projectId, projectName, currentQuota, onClose }: EditQuotaDialogProps) {
  const [quota, setQuota] = useState(currentQuota);
  const utils = trpc.useUtils();
  
  const updateMutation = trpc.quota.update.useMutation({
    onSuccess: () => {
      toast.success("Quota updated successfully");
      utils.quota.list.invalidate();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const handleSave = () => {
    updateMutation.mutate({
      projectId,
      ...quota,
    });
  };
  
  return (
    <DialogContent className="sm:max-w-[500px] bg-card border-border">
      <DialogHeader>
        <DialogTitle>Edit Quota - {projectName}</DialogTitle>
        <DialogDescription>
          Configure resource limits for this project.
        </DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="enabled">Enable Quota Enforcement</Label>
          <Switch
            id="enabled"
            checked={quota.enabled}
            onCheckedChange={(checked) => setQuota({ ...quota, enabled: checked })}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxVMs">Max VMs</Label>
            <Input
              id="maxVMs"
              type="number"
              value={quota.maxVMs}
              onChange={(e) => setQuota({ ...quota, maxVMs: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxCPU">Max CPU Cores</Label>
            <Input
              id="maxCPU"
              type="number"
              value={quota.maxCPU}
              onChange={(e) => setQuota({ ...quota, maxCPU: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxMemoryGB">Max Memory (GB)</Label>
            <Input
              id="maxMemoryGB"
              type="number"
              value={quota.maxMemoryGB}
              onChange={(e) => setQuota({ ...quota, maxMemoryGB: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxStorageGB">Max Storage (GB)</Label>
            <Input
              id="maxStorageGB"
              type="number"
              value={quota.maxStorageGB}
              onChange={(e) => setQuota({ ...quota, maxStorageGB: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxGPUs">Max GPUs</Label>
            <Input
              id="maxGPUs"
              type="number"
              value={quota.maxGPUs}
              onChange={(e) => setQuota({ ...quota, maxGPUs: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxSnapshots">Max Snapshots</Label>
            <Input
              id="maxSnapshots"
              type="number"
              value={quota.maxSnapshots}
              onChange={(e) => setQuota({ ...quota, maxSnapshots: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CreateTemplateDialog({ onClose }: { onClose: () => void }) {
  const [template, setTemplate] = useState({
    name: "",
    description: "",
    maxVMs: 10,
    maxCPU: 32,
    maxMemoryGB: 64,
    maxStorageGB: 500,
    maxGPUs: 0,
    maxSnapshots: 20,
    isDefault: false,
  });
  
  const utils = trpc.useUtils();
  
  const createMutation = trpc.quotaTemplate.create.useMutation({
    onSuccess: () => {
      toast.success("Template created successfully");
      utils.quotaTemplate.list.invalidate();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const handleCreate = () => {
    if (!template.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    createMutation.mutate(template);
  };
  
  return (
    <DialogContent className="sm:max-w-[500px] bg-card border-border">
      <DialogHeader>
        <DialogTitle>Create Quota Template</DialogTitle>
        <DialogDescription>
          Create a reusable quota template for quick assignment.
        </DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Template Name</Label>
          <Input
            id="name"
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            placeholder="e.g., Small Team, Enterprise"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={template.description}
            onChange={(e) => setTemplate({ ...template, description: e.target.value })}
            placeholder="Optional description"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Max VMs</Label>
            <Input
              type="number"
              value={template.maxVMs}
              onChange={(e) => setTemplate({ ...template, maxVMs: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label>Max CPU Cores</Label>
            <Input
              type="number"
              value={template.maxCPU}
              onChange={(e) => setTemplate({ ...template, maxCPU: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Memory (GB)</Label>
            <Input
              type="number"
              value={template.maxMemoryGB}
              onChange={(e) => setTemplate({ ...template, maxMemoryGB: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Storage (GB)</Label>
            <Input
              type="number"
              value={template.maxStorageGB}
              onChange={(e) => setTemplate({ ...template, maxStorageGB: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label>Max GPUs</Label>
            <Input
              type="number"
              value={template.maxGPUs}
              onChange={(e) => setTemplate({ ...template, maxGPUs: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Snapshots</Label>
            <Input
              type="number"
              value={template.maxSnapshots}
              onChange={(e) => setTemplate({ ...template, maxSnapshots: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="isDefault">Set as Default Template</Label>
          <Switch
            id="isDefault"
            checked={template.isDefault}
            onCheckedChange={(checked) => setTemplate({ ...template, isDefault: checked })}
          />
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleCreate} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Template"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function QuotaManagement() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [editingQuota, setEditingQuota] = useState<{ projectId: number; projectName: string } | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  
  const { data: quotas, isLoading: quotasLoading } = trpc.quota.list.useQuery();
  const { data: templates, isLoading: templatesLoading } = trpc.quotaTemplate.list.useQuery();
  const { data: projects } = trpc.project.list.useQuery();
  
  const utils = trpc.useUtils();
  
  const applyTemplateMutation = trpc.quota.applyTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template applied successfully");
      utils.quota.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const deleteTemplateMutation = trpc.quotaTemplate.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted successfully");
      utils.quotaTemplate.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  // Calculate overall statistics
  const totalStats = quotas?.reduce(
    (acc, q) => ({
      totalVMs: acc.totalVMs + (q.usage?.usedVMs || 0),
      totalCPU: acc.totalCPU + (q.usage?.usedCPU || 0),
      totalMemory: acc.totalMemory + (q.usage?.usedMemoryGB || 0),
      totalStorage: acc.totalStorage + (q.usage?.usedStorageGB || 0),
      maxVMs: acc.maxVMs + q.maxVMs,
      maxCPU: acc.maxCPU + q.maxCPU,
      maxMemory: acc.maxMemory + q.maxMemoryGB,
      maxStorage: acc.maxStorage + q.maxStorageGB,
    }),
    { totalVMs: 0, totalCPU: 0, totalMemory: 0, totalStorage: 0, maxVMs: 0, maxCPU: 0, maxMemory: 0, maxStorage: 0 }
  ) || { totalVMs: 0, totalCPU: 0, totalMemory: 0, totalStorage: 0, maxVMs: 0, maxCPU: 0, maxMemory: 0, maxStorage: 0 };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Resource Quotas</h1>
            <p className="text-muted-foreground mt-1">
              Manage resource limits and usage across projects
            </p>
          </div>
        </div>
        
        {/* Overall Resource Usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuotaCard
            title="Virtual Machines"
            icon={<Server className="w-4 h-4 text-blue-400" />}
            used={totalStats.totalVMs}
            limit={totalStats.maxVMs}
            unit=""
            color="bg-blue-500/20"
          />
          <QuotaCard
            title="CPU Cores"
            icon={<Cpu className="w-4 h-4 text-purple-400" />}
            used={totalStats.totalCPU}
            limit={totalStats.maxCPU}
            unit="cores"
            color="bg-purple-500/20"
          />
          <QuotaCard
            title="Memory"
            icon={<MemoryStick className="w-4 h-4 text-emerald-400" />}
            used={totalStats.totalMemory}
            limit={totalStats.maxMemory}
            unit="GB"
            color="bg-emerald-500/20"
          />
          <QuotaCard
            title="Storage"
            icon={<HardDrive className="w-4 h-4 text-amber-400" />}
            used={totalStats.totalStorage}
            limit={totalStats.maxStorage}
            unit="GB"
            color="bg-amber-500/20"
          />
        </div>
        
        {/* Tabs */}
        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="projects" className="data-[state=active]:bg-background">
              <FolderKanban className="w-4 h-4 mr-2" />
              Project Quotas
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-background">
              <Layers className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
          </TabsList>
          
          {/* Project Quotas Tab */}
          <TabsContent value="projects" className="space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Project Resource Quotas</CardTitle>
                    <CardDescription>
                      View and manage resource limits for each project
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {quotasLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : quotas && quotas.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead>Project</TableHead>
                        <TableHead>VMs</TableHead>
                        <TableHead>CPU</TableHead>
                        <TableHead>Memory</TableHead>
                        <TableHead>Storage</TableHead>
                        <TableHead>GPUs</TableHead>
                        <TableHead>Snapshots</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotas.map((quota) => {
                        const vmPercent = (quota.usage.usedVMs / quota.maxVMs) * 100;
                        const cpuPercent = (quota.usage.usedCPU / quota.maxCPU) * 100;
                        const memPercent = (quota.usage.usedMemoryGB / quota.maxMemoryGB) * 100;
                        const storagePercent = (quota.usage.usedStorageGB / quota.maxStorageGB) * 100;
                        const maxPercent = Math.max(vmPercent, cpuPercent, memPercent, storagePercent);
                        
                        return (
                          <TableRow key={quota.id} className="border-border/50">
                            <TableCell>
                              <div>
                                <div className="font-medium">{quota.projectName}</div>
                                <div className="text-xs text-muted-foreground">{quota.projectNamespace}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="text-sm">
                                    {quota.usage.usedVMs} / {quota.maxVMs}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {vmPercent.toFixed(1)}% used
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="text-sm">
                                    {quota.usage.usedCPU} / {quota.maxCPU}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {cpuPercent.toFixed(1)}% used
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="text-sm">
                                    {quota.usage.usedMemoryGB} / {quota.maxMemoryGB} GB
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {memPercent.toFixed(1)}% used
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="text-sm">
                                    {quota.usage.usedStorageGB} / {quota.maxStorageGB} GB
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {storagePercent.toFixed(1)}% used
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {quota.usage.usedGPUs} / {quota.maxGPUs}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {quota.usage.usedSnapshots} / {quota.maxSnapshots}
                              </div>
                            </TableCell>
                            <TableCell>
                              {!quota.enabled ? (
                                <Badge variant="secondary" className="text-xs">Disabled</Badge>
                              ) : maxPercent >= 95 ? (
                                <Badge variant="destructive" className="text-xs">Critical</Badge>
                              ) : maxPercent >= 80 ? (
                                <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-400">Warning</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-400">Healthy</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingQuota({ projectId: quota.projectId, projectName: quota.projectName })}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  </DialogTrigger>
                                  {editingQuota?.projectId === quota.projectId && (
                                    <EditQuotaDialog
                                      projectId={quota.projectId}
                                      projectName={quota.projectName}
                                      currentQuota={{
                                        maxVMs: quota.maxVMs,
                                        maxCPU: quota.maxCPU,
                                        maxMemoryGB: quota.maxMemoryGB,
                                        maxStorageGB: quota.maxStorageGB,
                                        maxGPUs: quota.maxGPUs,
                                        maxSnapshots: quota.maxSnapshots,
                                        enabled: quota.enabled,
                                      }}
                                      onClose={() => setEditingQuota(null)}
                                    />
                                  )}
                                </Dialog>
                                
                                <Select
                                  onValueChange={(templateId) => {
                                    applyTemplateMutation.mutate({
                                      projectId: quota.projectId,
                                      templateId: parseInt(templateId),
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-[140px] h-8">
                                    <SelectValue placeholder="Apply template" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {templates?.map((t) => (
                                      <SelectItem key={t.id} value={t.id.toString()}>
                                        {t.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-muted/50 mb-4">
                      <FolderKanban className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">No Projects Found</h3>
                    <p className="text-muted-foreground text-sm max-w-sm">
                      Create a project first to configure resource quotas.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Quota Templates</CardTitle>
                    <CardDescription>
                      Predefined quota profiles for quick assignment
                    </CardDescription>
                  </div>
                  <Dialog open={showCreateTemplate} onOpenChange={setShowCreateTemplate}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Template
                      </Button>
                    </DialogTrigger>
                    {showCreateTemplate && (
                      <CreateTemplateDialog onClose={() => setShowCreateTemplate(false)} />
                    )}
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : templates && templates.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((template) => (
                      <Card key={template.id} className="bg-muted/30 border-border/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              {template.name}
                              {template.isDefault && (
                                <Badge variant="secondary" className="text-xs">Default</Badge>
                              )}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteTemplateMutation.mutate({ id: template.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          {template.description && (
                            <CardDescription className="text-xs">
                              {template.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Server className="w-3 h-3 text-muted-foreground" />
                              <span>{template.maxVMs} VMs</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Cpu className="w-3 h-3 text-muted-foreground" />
                              <span>{template.maxCPU} cores</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MemoryStick className="w-3 h-3 text-muted-foreground" />
                              <span>{template.maxMemoryGB} GB</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <HardDrive className="w-3 h-3 text-muted-foreground" />
                              <span>{template.maxStorageGB} GB</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Zap className="w-3 h-3 text-muted-foreground" />
                              <span>{template.maxGPUs} GPUs</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Camera className="w-3 h-3 text-muted-foreground" />
                              <span>{template.maxSnapshots} snaps</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-muted/50 mb-4">
                      <Layers className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">No Templates</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mb-4">
                      Create quota templates for quick assignment to projects.
                    </p>
                    <Button size="sm" onClick={() => setShowCreateTemplate(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Template
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
