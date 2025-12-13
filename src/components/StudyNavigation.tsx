import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

interface StudyNavigationProps {
  allowBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

// Define valid navigation paths
const NAVIGATION_RULES: Record<string, { canGoBack: boolean; backTo?: string }> = {
  '/demographics': { canGoBack: false },
  '/pre-test': { canGoBack: true, backTo: '/demographics' },
  '/post-test': { canGoBack: false }, // Cannot go back from post-test to learning
  '/post-test-2': { canGoBack: true, backTo: '/post-test' },
  '/post-test-3': { canGoBack: true, backTo: '/post-test-2' },
};

const StudyNavigation = ({ allowBack, backTo, backLabel }: StudyNavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const rules = NAVIGATION_RULES[location.pathname];
  const canGoBack = allowBack ?? rules?.canGoBack ?? false;
  const destination = backTo ?? rules?.backTo;
  
  if (!canGoBack || !destination) {
    return null;
  }

  const handleBack = () => {
    navigate(destination);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className="gap-1 text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="w-4 h-4" />
      {backLabel || 'Back'}
    </Button>
  );
};

// Security hook to detect mode switching attempts
export const useModeSwitchProtection = () => {
  const navigate = useNavigate();
  
  const checkModeSwitch = (newMode: string) => {
    const currentMode = sessionStorage.getItem('studyMode');
    const sessionId = sessionStorage.getItem('sessionId');
    
    // If there's an existing session with a different mode, this is a switch attempt
    if (currentMode && sessionId && currentMode !== newMode) {
      // Reset the entire session
      sessionStorage.removeItem('sessionId');
      sessionStorage.removeItem('studyMode');
      sessionStorage.removeItem('demographics');
      sessionStorage.removeItem('preTest');
      sessionStorage.removeItem('postTestPage1');
      sessionStorage.removeItem('postTestPage2');
      sessionStorage.removeItem('postTestPage3');
      
      toast.error('Mode switching is not allowed. Your session has been reset.', {
        description: 'Please start the study from the beginning.',
        duration: 5000,
      });
      
      navigate('/', { replace: true });
      return false; // Indicate switch was blocked
    }
    
    return true; // Mode switch is allowed (same mode or new session)
  };
  
  return { checkModeSwitch };
};

export default StudyNavigation;
