import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useProject } from '@/contexts/ProjectContext';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FolderKanban,
  Plus,
  Users,
  Crown,
  Shield,
  User,
  Eye,
  UserPlus,
  Trash2,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
};

const roleColors = {
  owner: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  admin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  member: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  viewer: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export default function ProjectManagement() {
  const { currentProject, projects, refreshProjects, canManage, setCurrentProject } = useProject();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectNamespace, setNewProjectNamespace] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member' | 'viewer'>('member');

  // Fetch project members
  const { data: members = [], refetch: refetchMembers } = trpc.project.members.useQuery(
    { projectId: currentProject?.id || 0 },
    { enabled: !!currentProject }
  );

  // Fetch all users for adding members
  const { data: allUsers = [] } = trpc.project.allUsers.useQuery();

  // Mutations
  const createProjectMutation = trpc.project.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsCreateDialogOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      setNewProjectNamespace('');
      refreshProjects();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addMemberMutation = trpc.project.addMember.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsAddMemberDialogOpen(false);
      setSelectedUserId('');
      refetchMembers();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeMemberMutation = trpc.project.removeMember.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchMembers();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateRoleMutation = trpc.project.updateMemberRole.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchMembers();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreateProject = () => {
    if (!newProjectName.trim() || !newProjectNamespace.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    createProjectMutation.mutate({
      name: newProjectName,
      description: newProjectDescription || undefined,
      namespace: newProjectNamespace,
    });
  };

  const handleAddMember = () => {
    if (!selectedUserId || !currentProject) {
      toast.error('Please select a user');
      return;
    }
    addMemberMutation.mutate({
      projectId: currentProject.id,
      userId: parseInt(selectedUserId, 10),
      role: selectedRole,
    });
  };

  const handleRemoveMember = (userId: number) => {
    if (!currentProject) return;
    removeMemberMutation.mutate({
      projectId: currentProject.id,
      userId,
    });
  };

  const handleUpdateRole = (userId: number, role: 'admin' | 'member' | 'viewer') => {
    if (!currentProject) return;
    updateRoleMutation.mutate({
      projectId: currentProject.id,
      userId,
      role,
    });
  };

  // Filter out users who are already members
  const availableUsers = allUsers.filter(
    (user) => !members.some((m) => m.userId === user.id)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Project Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage your projects and team members
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshProjects()}
              className="border-border/50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Create a new project to organize your virtual machines and resources.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name *</Label>
                    <Input
                      id="name"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="My Project"
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="namespace">Kubernetes Namespace *</Label>
                    <Input
                      id="namespace"
                      value={newProjectNamespace}
                      onChange={(e) => setNewProjectNamespace(e.target.value)}
                      placeholder="my-project-ns"
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      placeholder="Optional description..."
                      className="bg-background/50"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateProject}
                    disabled={createProjectMutation.isPending}
                    className="bg-gradient-to-r from-cyan-500 to-blue-500"
                  >
                    {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const RoleIcon = roleIcons[project.userRole];
            const isSelected = currentProject?.id === project.id;
            return (
              <Card
                key={project.id}
                className={`cursor-pointer transition-all hover:border-cyan-500/50 ${
                  isSelected ? 'border-cyan-500 bg-cyan-500/5' : 'bg-card/50 border-border/50'
                }`}
                onClick={() => setCurrentProject(project)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-cyan-500/20' : 'bg-muted'}`}>
                        <FolderKanban className={`h-5 w-5 ${isSelected ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {project.namespace}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={roleColors[project.userRole]}>
                      <RoleIcon className="h-3 w-3 mr-1" />
                      {project.userRole}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description || 'No description'}
                  </p>
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <span className="text-xs text-cyan-400 font-medium">Currently Selected</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Current Project Members */}
        {currentProject && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Users className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>
                      Members of "{currentProject.name}"
                    </CardDescription>
                  </div>
                </div>
                {canManage && (
                  <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border">
                      <DialogHeader>
                        <DialogTitle>Add Team Member</DialogTitle>
                        <DialogDescription>
                          Add a user to this project with a specific role.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Select User</Label>
                          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Choose a user..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableUsers.map((user) => (
                                <SelectItem key={user.id} value={user.id.toString()}>
                                  {user.name || user.email || `User ${user.id}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin - Full management access</SelectItem>
                              <SelectItem value="member">Member - Create and manage VMs</SelectItem>
                              <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddMemberDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddMember}
                          disabled={addMemberMutation.isPending || !selectedUserId}
                        >
                          {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const RoleIcon = roleIcons[member.role as keyof typeof roleIcons] || User;
                    return (
                      <TableRow key={member.id} className="border-border/50">
                        <TableCell className="font-medium">
                          {member.userName || `User ${member.userId}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.userEmail || '-'}
                        </TableCell>
                        <TableCell>
                          {canManage && member.role !== 'owner' ? (
                            <Select
                              value={member.role}
                              onValueChange={(v) => handleUpdateRole(member.userId, v as any)}
                            >
                              <SelectTrigger className="w-[120px] h-8 bg-background/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={roleColors[member.role as keyof typeof roleColors] || roleColors.member}>
                              <RoleIcon className="h-3 w-3 mr-1" />
                              {member.role}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            {member.role !== 'owner' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMember(member.userId)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground py-8">
                        No members found. The project owner has full access.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
