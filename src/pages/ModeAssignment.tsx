import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StudyMode } from "@/types/study";

const ModeAssignment = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Random assignment to one of three modes
    const modes: StudyMode[] = ['text', 'voice', 'avatar'];
    const randomMode = modes[Math.floor(Math.random() * modes.length)];
    
    // Store the assigned mode
    sessionStorage.setItem('studyMode', randomMode);
    
    // Generate unique session ID
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('sessionId', sessionId);
    
    // Initialize session data
    const sessionData = {
      sessionId,
      mode: randomMode,
      startedAt: Date.now(),
      scenarios: []
    };
    sessionStorage.setItem('sessionData', JSON.stringify(sessionData));
    
    // Navigate to first scenario after brief delay
    setTimeout(() => {
      navigate(`/scenario/${randomMode}/bias`);
    }, 1500);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-muted-foreground">Preparing your learning experience...</p>
      </div>
    </div>
  );
};

export default ModeAssignment;
