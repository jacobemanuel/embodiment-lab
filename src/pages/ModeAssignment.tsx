import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StudyMode } from "@/types/study";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageSquare, Smile } from "lucide-react";
import logo from "@/assets/logo-white.png";
import { toast } from "sonner";
import { useStudyFlowGuard } from "@/hooks/useStudyFlowGuard";
import ExitStudyButton from "@/components/ExitStudyButton";
import ParticipantFooter from "@/components/ParticipantFooter";

const ModeAssignment = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<StudyMode | null>(null);

  // Guard: Ensure user completed pre-test
  useStudyFlowGuard('mode-assignment');

  // Check if mode was pre-assigned from study entry link or already selected
  useEffect(() => {
    const existingMode = sessionStorage.getItem('studyMode') as StudyMode | null;
    const preAssignedMode = sessionStorage.getItem('preAssignedMode') as StudyMode | null;
    const existingSessionId = sessionStorage.getItem('sessionId');
    
    // If mode was pre-assigned from /study/:mode link, auto-select it
    if (preAssignedMode && existingSessionId && !existingMode) {
      sessionStorage.removeItem('preAssignedMode'); // Clear after use
      handleModeSelect(preAssignedMode);
      return;
    }
    
    // If mode already selected, redirect back to learning
    if (existingMode && existingSessionId) {
      navigate(`/learning/${existingMode}`, { replace: true });
    }
  }, [navigate]);

  const handleModeSelect = async (mode: StudyMode) => {
    // SECURITY: Check if trying to switch modes mid-session
    const existingMode = sessionStorage.getItem('studyMode') as StudyMode | null;
    const existingSessionId = sessionStorage.getItem('sessionId');
    
    if (existingMode && existingSessionId && existingMode !== mode) {
      // Mode switching attempt detected - mark session as reset in database
      try {
        await supabase.functions.invoke('save-study-data', {
          body: {
            action: 'reset_session',
            sessionId: existingSessionId,
            reason: 'mode_switch'
          }
        });
      } catch (error) {
        console.error('Failed to mark session as reset:', error);
      }
      
      // Clear all local session data
      sessionStorage.removeItem('sessionId');
      sessionStorage.removeItem('studyMode');
      sessionStorage.removeItem('demographics');
      sessionStorage.removeItem('preTest');
      sessionStorage.removeItem('postTestPage1');
      sessionStorage.removeItem('postTestPage2');
      sessionStorage.removeItem('postTestPage3');
      
      toast.error('Mode switching is not allowed during an active session.', {
        description: 'Your session has been reset. Please start from the beginning.',
        duration: 6000,
      });
      
      navigate('/', { replace: true });
      return;
    }

    setSelectedMode(mode);
    setIsLoading(true);

    try {
      const currentSessionId = sessionStorage.getItem('sessionId');

      if (currentSessionId) {
        // Update existing session via edge function (bypasses RLS)
        const { data, error } = await supabase.functions.invoke('save-study-data', {
          body: {
            action: 'update_mode',
            sessionId: currentSessionId,
            mode
          }
        });

        if (error) {
          console.error('Error updating mode:', error);
        }

        sessionStorage.setItem('studyMode', mode);
        navigate(`/learning/${mode}`);
      } else {
        // No existing session - create one
        const { createStudySession } = await import('@/lib/studyData');
        const sessionId = await createStudySession(mode);
        sessionStorage.setItem('studyMode', mode);
        sessionStorage.setItem('sessionId', sessionId);
        navigate(`/learning/${mode}`);
      }
    } catch (error) {
      console.error('Error handling mode selection:', error);
      sessionStorage.setItem('studyMode', mode);
      navigate(`/learning/${mode}`);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border p-4 flex items-center justify-between">
        <img src={logo} alt="Logo" className="h-8" />
        <ExitStudyButton />
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Choose Your Learning Mode
            </h1>
            <p className="text-muted-foreground text-lg">
              Select how you'd like to learn about AI Image Generation
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Text Mode */}
            <button
              onClick={() => handleModeSelect('text')}
              disabled={isLoading}
              className={`group relative p-8 rounded-2xl border-2 transition-all text-left ${
                selectedMode === 'text' 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50 bg-card'
              }`}
            >
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold">Text Mode</h2>
                <p className="text-muted-foreground text-justify">
                  Learn through interactive chat. Read slides and discuss with an AI tutor at your own pace.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Interactive chat interface</li>
                  <li>• AI Playground integration</li>
                  <li>• Self-paced learning</li>
                </ul>
              </div>
              {selectedMode === 'text' && isLoading && (
                <div className="absolute inset-0 bg-background/80 rounded-2xl flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>

            {/* Avatar Mode */}
            <button
              onClick={() => handleModeSelect('avatar')}
              disabled={isLoading}
              className={`group relative p-8 rounded-2xl border-2 transition-all text-left ${
                selectedMode === 'avatar' 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50 bg-card'
              }`}
            >
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Smile className="w-8 h-8 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-semibold">Avatar Mode</h2>
                <p className="text-muted-foreground text-justify">
                  Learn with an AI avatar tutor who speaks to you and responds to your voice.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Real-time AI avatar</li>
                  <li>• Voice conversation</li>
                  <li>• Live transcription</li>
                </ul>
              </div>
              {selectedMode === 'avatar' && isLoading && (
                <div className="absolute inset-0 bg-background/80 rounded-2xl flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
      <ParticipantFooter />
    </div>
  );
};

export default ModeAssignment;
