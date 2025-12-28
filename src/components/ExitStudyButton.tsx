import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { clearTelemetrySavedFlag, clearTimingLog } from "@/lib/sessionTelemetry";

interface ExitStudyButtonProps {
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

const ExitStudyButton = ({ 
  variant = "ghost", 
  size = "sm",
  className = "",
  showLabel = true 
}: ExitStudyButtonProps) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();

  const handleExit = async () => {
    setIsExiting(true);
    
    try {
      sessionStorage.setItem('studyExitRequested', 'true');
      // Get session ID before clearing
      const sessionId = sessionStorage.getItem('sessionId');
      
      // If there's a session, mark it as withdrawn (not suspicious, not reset)
      // This is a legitimate withdrawal, different from cheating attempts
      if (sessionId) {
        await supabase
          .from('study_sessions')
          .update({ 
            status: 'withdrawn',
            completed_at: null // Ensure it's not marked as completed
          })
          .eq('session_id', sessionId);
      }
      
      // Clear all session data
      sessionStorage.removeItem('sessionId');
      sessionStorage.removeItem('studyMode');
      sessionStorage.removeItem('demographics');
      sessionStorage.removeItem('preTest');
      sessionStorage.removeItem('postTestPage1');
      sessionStorage.removeItem('postTestPage2');
      sessionStorage.removeItem('postTest1');
      sessionStorage.removeItem('currentSlide');
      clearTimingLog();
      clearTelemetrySavedFlag();
      
      // Navigate to home
      navigate('/');
    } catch (error) {
      console.error('Error during withdrawal:', error);
      // Still navigate home even if update fails
      navigate('/');
    } finally {
      sessionStorage.removeItem('studyExitRequested');
      setIsExiting(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowConfirmDialog(true)}
        className={`text-muted-foreground hover:text-destructive ${className}`}
        title="Exit and withdraw from study"
      >
        <XCircle className="w-4 h-4" />
        {showLabel && <span className="ml-2">Exit Study</span>}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Study?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to withdraw from the study? Your progress will not be saved.
              </p>
              <p className="text-muted-foreground text-sm">
                You can participate again anytime by starting a new session.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExiting}>
              Continue Study
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExit}
              disabled={isExiting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isExiting ? "Exiting..." : "Yes, Exit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ExitStudyButton;
