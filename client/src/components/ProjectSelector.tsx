import { useProject, Project } from '@/contexts/ProjectContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Crown, Shield, User, Eye } from 'lucide-react';

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

interface ProjectSelectorProps {
  className?: string;
  compact?: boolean;
}

export function ProjectSelector({ className, compact = false }: ProjectSelectorProps) {
  const { currentProject, projects, setCurrentProject, isLoading } = useProject();

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
        <FolderKanban className="h-4 w-4 text-muted-foreground animate-pulse" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
        <FolderKanban className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No projects</span>
      </div>
    );
  }

  const handleProjectChange = (projectId: string) => {
    const project = projects.find(p => p.id.toString() === projectId);
    if (project) {
      setCurrentProject(project);
    }
  };

  return (
    <Select
      value={currentProject?.id.toString() || ''}
      onValueChange={handleProjectChange}
    >
      <SelectTrigger className={`${compact ? 'w-[180px]' : 'w-[240px]'} bg-card/50 border-border/50 ${className}`}>
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-cyan-400" />
          <SelectValue placeholder="Select project">
            {currentProject && (
              <span className="truncate">{currentProject.name}</span>
            )}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {projects.map((project) => {
          const RoleIcon = roleIcons[project.userRole];
          return (
            <SelectItem
              key={project.id}
              value={project.id.toString()}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderKanban className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span className="truncate">{project.name}</span>
                </div>
                <Badge
                  variant="outline"
                  className={`${roleColors[project.userRole]} text-xs shrink-0`}
                >
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {project.userRole}
                </Badge>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function ProjectBadge() {
  const { currentProject } = useProject();

  if (!currentProject) return null;

  const RoleIcon = roleIcons[currentProject.userRole];

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={`${roleColors[currentProject.userRole]} text-xs`}
      >
        <RoleIcon className="h-3 w-3 mr-1" />
        {currentProject.userRole}
      </Badge>
    </div>
  );
}
