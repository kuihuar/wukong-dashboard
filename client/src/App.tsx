import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import Home from "./pages/Home";
import VMList from "./pages/VMList";
import VMDetail from "./pages/VMDetail";
import VMCreate from "./pages/VMCreate";
import Snapshots from "./pages/Snapshots";
import QuotaManagement from "./pages/QuotaManagement";
import ProjectManagement from "./pages/ProjectManagement";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/vms" component={VMList} />
      <Route path="/vms/create" component={VMCreate} />
      <Route path="/vms/:id" component={VMDetail} />
      <Route path="/snapshots" component={Snapshots} />
      <Route path="/quotas" component={QuotaManagement} />
      <Route path="/projects" component={ProjectManagement} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ProjectProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ProjectProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
