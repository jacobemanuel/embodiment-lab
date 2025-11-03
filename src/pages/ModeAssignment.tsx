import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StudyMode } from "@/types/study";
import { createStudySession } from "@/lib/studyData";

const ModeAssignment = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const initSession = async () => {
      try {
        // Random assignment to one of three modes
        const modes: StudyMode[] = ['text', 'voice', 'avatar'];
        const randomMode = modes[Math.floor(Math.random() * modes.length)];
        
        // Generate unique session ID
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Create session in database
        await createStudySession(sessionId, randomMode);
        
        // Store in sessionStorage for client-side use
        sessionStorage.setItem('studyMode', randomMode);
        sessionStorage.setItem('sessionId', sessionId);
        
        // Navigate to first scenario after brief delay
        setTimeout(() => {
          navigate(`/scenario/${randomMode}/bias`);
        }, 1500);
      } catch (error) {
        console.error('Error creating session:', error);
        // Still navigate even if db save fails (fallback to sessionStorage only)
        const modes: StudyMode[] = ['text', 'voice', 'avatar'];
        const randomMode = modes[Math.floor(Math.random() * modes.length)];
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('studyMode', randomMode);
        sessionStorage.setItem('sessionId', sessionId);
        setTimeout(() => navigate(`/scenario/${randomMode}/bias`), 1500);
      }
    };
    
    initSession();
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
