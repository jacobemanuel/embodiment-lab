import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionProvider } from "@/components/SessionProvider";
import Welcome from "./pages/Welcome";
import Consent from "./pages/Consent";
import Demographics from "./pages/Demographics";
import PreTest from "./pages/PreTest";
import ModeAssignment from "./pages/ModeAssignment";
import Learning from "./pages/Learning";
import Scenario from "./pages/Scenario";
import ScenarioFeedback from "./pages/ScenarioFeedback";
import PostTestPage1 from "./pages/PostTestPage1";
import PostTestPage2 from "./pages/PostTestPage2";
import PostTestPage3 from "./pages/PostTestPage3";
import Completion from "./pages/Completion";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionProvider>
            <Routes>
              <Route path="/" element={<Welcome />} />
              <Route path="/consent" element={<Consent />} />
              <Route path="/demographics" element={<Demographics />} />
              <Route path="/pre-test" element={<PreTest />} />
              <Route path="/mode-assignment" element={<ModeAssignment />} />
              <Route path="/learning/:mode" element={<Learning />} />
              <Route path="/scenario/:mode/:scenarioId" element={<Scenario />} />
              <Route path="/scenario/:mode/:scenarioId/feedback" element={<ScenarioFeedback />} />
              <Route path="/post-test" element={<PostTestPage1 />} />
              <Route path="/post-test-2" element={<PostTestPage2 />} />
              <Route path="/post-test-3" element={<PostTestPage3 />} />
              <Route path="/completion" element={<Completion />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SessionProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
