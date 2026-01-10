import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  namespace: string;
  ownerId: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
}

interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  setCurrentProject: (project: Project) => void;
  refreshProjects: () => void;
  canManage: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const PROJECT_STORAGE_KEY = 'wukong_current_project_id';

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's projects
  const { 
    data: projects = [], 
    isLoading: projectsLoading,
    refetch: refetchProjects,
  } = trpc.project.myProjects.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  // Get or create default project
  const { data: defaultProject } = trpc.project.getDefault.useQuery(undefined, {
    enabled: isAuthenticated && projects.length === 0,
  });

  // Load saved project from localStorage
  useEffect(() => {
    if (!isAuthenticated || projectsLoading) return;
    
    const savedProjectId = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (savedProjectId) {
      const savedProject = projects.find(p => p.id === parseInt(savedProjectId, 10));
      if (savedProject) {
        setCurrentProjectState(savedProject);
        return;
      }
    }
    
    // Fall back to default or first project
    if (defaultProject) {
      setCurrentProjectState(defaultProject);
    } else if (projects.length > 0) {
      setCurrentProjectState(projects[0]);
    }
  }, [isAuthenticated, projectsLoading, projects, defaultProject]);

  const setCurrentProject = useCallback((project: Project) => {
    setCurrentProjectState(project);
    localStorage.setItem(PROJECT_STORAGE_KEY, project.id.toString());
  }, []);

  const refreshProjects = useCallback(() => {
    refetchProjects();
  }, [refetchProjects]);

  // Determine if current user can manage the project
  const canManage = currentProject?.userRole === 'owner' || currentProject?.userRole === 'admin';

  const isLoading = authLoading || projectsLoading;

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        projects,
        isLoading,
        error,
        setCurrentProject,
        refreshProjects,
        canManage,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
