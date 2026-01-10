import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import VMList from "./pages/VMList";
import VMDetail from "./pages/VMDetail";
import VMCreate from "./pages/VMCreate";
import Snapshots from "./pages/Snapshots";
import QuotaManagement from "./pages/QuotaManagement";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/vms" component={VMList} />
      <Route path="/vms/create" component={VMCreate} />
      <Route path="/vms/:id" component={VMDetail} />
      <Route path="/snapshots" component={Snapshots} />
      <Route path="/quotas" component={QuotaManagement} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
