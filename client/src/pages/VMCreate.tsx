import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Server,
  ArrowLeft,
  ArrowRight,
  Cpu,
  HardDrive,
  Network,
  Monitor,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type Step = "basics" | "storage" | "network" | "gpu" | "review";

const steps: { id: Step; title: string; icon: React.ElementType }[] = [
  { id: "basics", title: "Basics", icon: Server },
  { id: "storage", title: "Storage", icon: HardDrive },
  { id: "network", title: "Network", icon: Network },
  { id: "gpu", title: "GPU", icon: Monitor },
  { id: "review", title: "Review", icon: Check },
];

const osImages = [
  { value: "ubuntu:22.04", label: "Ubuntu 22.04 LTS", description: "Latest LTS release" },
  { value: "ubuntu:20.04", label: "Ubuntu 20.04 LTS", description: "Previous LTS release" },
  { value: "centos:8", label: "CentOS 8 Stream", description: "Enterprise Linux" },
  { value: "debian:11", label: "Debian 11", description: "Stable release" },
  { value: "rocky:9", label: "Rocky Linux 9", description: "RHEL compatible" },
  { value: "nvidia/cuda:12.0", label: "Ubuntu + CUDA 12.0", description: "GPU workloads" },
];

const storageClasses = [
  { value: "longhorn", label: "Longhorn", description: "Default distributed storage" },
  { value: "longhorn-ssd", label: "Longhorn SSD", description: "High performance SSD" },
  { value: "local-path", label: "Local Path", description: "Node-local storage" },
];

export default function VMCreate() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>("basics");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation('/login');
    }
  }, [user, loading, setLocation]);

  if (loading || !user) {
    return null; // Will redirect
  }

  // Form state
  const [name, setName] = useState("");
  const [cpu, setCpu] = useState(2);
  const [memory, setMemory] = useState(4);
  const [osImage, setOsImage] = useState("ubuntu:22.04");

  const [disks, setDisks] = useState([
    { name: "rootdisk", size: "80", storageClassName: "longhorn", boot: true, image: "" }
  ]);

  const [networks, setNetworks] = useState([
    { name: "default", type: "pod", mode: "dhcp" as "dhcp" | "static", ipAddress: "", gateway: "" }
  ]);

  const [enableGpu, setEnableGpu] = useState(false);
  const [gpus, setGpus] = useState([
    { name: "gpu-0", deviceName: "nvidia.com/gpu" }
  ]);

  // Quota check - using default project (id: 1) for now
  const { data: quotaCheck } = trpc.quota.check.useQuery({
    projectId: 1,
    cpu,
    memoryGB: memory,
    storageGB: disks.reduce((sum, d) => sum + parseInt(d.size || "0"), 0),
    gpus: enableGpu ? gpus.length : 0,
  });

  const hasQuotaWarning = quotaCheck && !quotaCheck.allowed;
  const quotaWarningReason = quotaCheck?.reason || "";

  const createMutation = trpc.vm.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setLocation("/vms");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const addDisk = () => {
    setDisks([...disks, {
      name: `disk-${disks.length}`,
      size: "100",
      storageClassName: "longhorn",
      boot: false,
      image: ""
    }]);
  };

  const removeDisk = (index: number) => {
    if (disks.length > 1) {
      setDisks(disks.filter((_, i) => i !== index));
    }
  };

  const updateDisk = (index: number, field: string, value: string | boolean) => {
    const newDisks = [...disks];
    newDisks[index] = { ...newDisks[index], [field]: value };
    setDisks(newDisks);
  };

  const addNetwork = () => {
    setNetworks([...networks, {
      name: `net-${networks.length}`,
      type: "bridge",
      mode: "dhcp",
      ipAddress: "",
      gateway: ""
    }]);
  };

  const removeNetwork = (index: number) => {
    if (networks.length > 1) {
      setNetworks(networks.filter((_, i) => i !== index));
    }
  };

  const updateNetwork = (index: number, field: string, value: string) => {
    const newNetworks = [...networks];
    newNetworks[index] = { ...newNetworks[index], [field]: value };
    setNetworks(newNetworks);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Please enter a VM name");
      setCurrentStep("basics");
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      cpu,
      memory: `${memory}Gi`,
      osImage,
      disks: disks.map(d => ({
        ...d,
        size: `${d.size}Gi`,
        image: d.boot ? osImage : undefined
      })),
      networks: networks.map(n => ({
        name: n.name,
        type: n.type,
        mode: n.mode,
        ipAddress: n.mode === "static" ? n.ipAddress : undefined,
        gateway: n.mode === "static" ? n.gateway : undefined
      })),
      gpus: enableGpu ? gpus : undefined
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/vms")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Virtual Machine</h1>
          <p className="text-muted-foreground mt-1">
            Configure and deploy a new Kubernetes virtual machine
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;
          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <step.icon className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">{step.title}</span>
              </button>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${isCompleted ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="glass-card">
        {/* Basics Step */}
        {currentStep === "basics" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                Basic Configuration
              </CardTitle>
              <CardDescription>
                Set the name, operating system, and compute resources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">VM Name</Label>
                <Input
                  id="name"
                  placeholder="my-virtual-machine"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Operating System</Label>
                <Select value={osImage} onValueChange={setOsImage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {osImages.map((os) => (
                      <SelectItem key={os.value} value={os.value}>
                        <div className="flex flex-col">
                          <span>{os.label}</span>
                          <span className="text-xs text-muted-foreground">{os.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>CPU Cores</Label>
                    <span className="text-sm font-medium">{cpu} vCPU</span>
                  </div>
                  <Slider
                    value={[cpu]}
                    onValueChange={([v]) => setCpu(v)}
                    min={1}
                    max={32}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 vCPU</span>
                    <span>32 vCPU</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Memory</Label>
                    <span className="text-sm font-medium">{memory} Gi</span>
                  </div>
                  <Slider
                    value={[memory]}
                    onValueChange={([v]) => setMemory(v)}
                    min={1}
                    max={128}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 Gi</span>
                    <span>128 Gi</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Storage Step */}
        {currentStep === "storage" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                Storage Configuration
              </CardTitle>
              <CardDescription>
                Configure disks and storage classes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {disks.map((disk, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Disk {index + 1}</span>
                      {disk.boot && <Badge variant="outline">Boot</Badge>}
                    </div>
                    {disks.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDisk(index)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={disk.name}
                        onChange={(e) => updateDisk(index, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Size (Gi)</Label>
                      <Input
                        type="number"
                        value={disk.size}
                        onChange={(e) => updateDisk(index, "size", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Storage Class</Label>
                    <Select
                      value={disk.storageClassName}
                      onValueChange={(v) => updateDisk(index, "storageClassName", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {storageClasses.map((sc) => (
                          <SelectItem key={sc.value} value={sc.value}>
                            <div className="flex flex-col">
                              <span>{sc.label}</span>
                              <span className="text-xs text-muted-foreground">{sc.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={addDisk} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add Disk
              </Button>
            </CardContent>
          </>
        )}

        {/* Network Step */}
        {currentStep === "network" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Network Configuration
              </CardTitle>
              <CardDescription>
                Configure network interfaces and IP settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {networks.map((net, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Interface {index + 1}</span>
                      {index === 0 && <Badge variant="outline">Primary</Badge>}
                    </div>
                    {networks.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNetwork(index)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={net.name}
                        onChange={(e) => updateNetwork(index, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={net.type}
                        onValueChange={(v) => updateNetwork(index, "type", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pod">Pod Network</SelectItem>
                          <SelectItem value="bridge">Bridge</SelectItem>
                          <SelectItem value="sriov">SR-IOV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>IP Mode</Label>
                    <Select
                      value={net.mode}
                      onValueChange={(v) => updateNetwork(index, "mode", v as "dhcp" | "static")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dhcp">DHCP</SelectItem>
                        <SelectItem value="static">Static IP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {net.mode === "static" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>IP Address</Label>
                        <Input
                          placeholder="192.168.1.100/24"
                          value={net.ipAddress}
                          onChange={(e) => updateNetwork(index, "ipAddress", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Gateway</Label>
                        <Input
                          placeholder="192.168.1.1"
                          value={net.gateway}
                          onChange={(e) => updateNetwork(index, "gateway", e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button variant="outline" onClick={addNetwork} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add Network Interface
              </Button>
            </CardContent>
          </>
        )}

        {/* GPU Step */}
        {currentStep === "gpu" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                GPU Configuration
              </CardTitle>
              <CardDescription>
                Enable GPU passthrough for compute workloads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                    <Monitor className="h-5 w-5 text-chart-3" />
                  </div>
                  <div>
                    <p className="font-medium">Enable GPU Passthrough</p>
                    <p className="text-sm text-muted-foreground">
                      Attach GPU devices for ML/AI workloads
                    </p>
                  </div>
                </div>
                <Switch checked={enableGpu} onCheckedChange={setEnableGpu} />
              </div>

              {enableGpu && (
                <div className="space-y-4">
                  {gpus.map((gpu, index) => (
                    <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">GPU {index + 1}</span>
                        {gpus.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setGpus(gpus.filter((_, i) => i !== index))}
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={gpu.name}
                            onChange={(e) => {
                              const newGpus = [...gpus];
                              newGpus[index] = { ...newGpus[index], name: e.target.value };
                              setGpus(newGpus);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Device Name</Label>
                          <Select
                            value={gpu.deviceName}
                            onValueChange={(v) => {
                              const newGpus = [...gpus];
                              newGpus[index] = { ...newGpus[index], deviceName: v };
                              setGpus(newGpus);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nvidia.com/gpu">NVIDIA GPU</SelectItem>
                              <SelectItem value="amd.com/gpu">AMD GPU</SelectItem>
                              <SelectItem value="intel.com/gpu">Intel GPU</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    onClick={() => setGpus([...gpus, { name: `gpu-${gpus.length}`, deviceName: "nvidia.com/gpu" }])}
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add GPU
                  </Button>
                </div>
              )}
            </CardContent>
          </>
        )}

        {/* Review Step */}
        {currentStep === "review" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                Review Configuration
              </CardTitle>
              <CardDescription>
                Review your settings before creating the VM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quota Warning */}
              {hasQuotaWarning && (
                <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Quota Exceeded</AlertTitle>
                  <AlertDescription>
                    {quotaWarningReason || "This VM configuration exceeds your project's resource quota. Please reduce the requested resources or contact an administrator."}
                  </AlertDescription>
                </Alert>
              )}

              {/* Basics Summary */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Basic Configuration
                </h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{name || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OS Image</span>
                    <span className="font-medium">{osImages.find(o => o.value === osImage)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CPU</span>
                    <span className="font-medium">{cpu} vCPU</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Memory</span>
                    <span className="font-medium">{memory} Gi</span>
                  </div>
                </div>
              </div>

              {/* Storage Summary */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Storage ({disks.length} disk{disks.length > 1 ? "s" : ""})
                </h4>
                <div className="space-y-2">
                  {disks.map((disk, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{disk.name}</span>
                      <span className="font-medium">{disk.size} Gi ({disk.storageClassName})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Network Summary */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Network ({networks.length} interface{networks.length > 1 ? "s" : ""})
                </h4>
                <div className="space-y-2">
                  {networks.map((net, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{net.name}</span>
                      <span className="font-medium">
                        {net.type} / {net.mode.toUpperCase()}
                        {net.mode === "static" && net.ipAddress && ` (${net.ipAddress})`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* GPU Summary */}
              {enableGpu && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    GPU ({gpus.length} device{gpus.length > 1 ? "s" : ""})
                  </h4>
                  <div className="space-y-2">
                    {gpus.map((gpu, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{gpu.name}</span>
                        <span className="font-medium">{gpu.deviceName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between p-6 pt-0">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentStepIndex === 0}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>

          {currentStep === "review" ? (
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || hasQuotaWarning}
              className="gap-2"
            >
              {createMutation.isPending ? "Creating..." : hasQuotaWarning ? "Quota Exceeded" : "Create VM"}
              <Check className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={goNext} className="gap-2">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
