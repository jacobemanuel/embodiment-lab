import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Welcome from "./pages/Welcome";
import Consent from "./pages/Consent";
import Demographics from "./pages/Demographics";
import PreTest from "./pages/PreTest";
import ModeAssignment from "./pages/ModeAssignment";
import Scenario from "./pages/Scenario";
import ScenarioFeedback from "./pages/ScenarioFeedback";
import PostTest from "./pages/PostTest";
import Completion from "./pages/Completion";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/consent" element={<Consent />} />
          <Route path="/demographics" element={<Demographics />} />
          <Route path="/pre-test" element={<PreTest />} />
          <Route path="/mode-assignment" element={<ModeAssignment />} />
          <Route path="/scenario/:mode/:scenarioId" element={<Scenario />} />
          <Route path="/scenario/:mode/:scenarioId/feedback" element={<ScenarioFeedback />} />
          <Route path="/post-test" element={<PostTest />} />
          <Route path="/completion" element={<Completion />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
