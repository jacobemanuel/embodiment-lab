import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Message, StudyMode, ScenarioData } from "@/types/study";
import { scenarios } from "@/data/scenarios";
import { TextMode } from "@/components/modes/TextMode";
import { VoiceMode } from "@/components/modes/VoiceMode";
import { AvatarMode } from "@/components/modes/AvatarMode";
import { ScenarioProgress } from "@/components/ScenarioProgress";
import { ModuleNavigation } from "@/components/ModuleNavigation";
import logo from "@/assets/logo-white.png";
import { Button } from "@/components/ui/button";
import { HelpCircle, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Scenario = () => {
  const { mode: urlMode, scenarioId } = useParams<{ mode: StudyMode; scenarioId: string }>();
  const navigate = useNavigate();
  
  const [currentMode, setCurrentMode] = useState<StudyMode>(urlMode || 'text');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const scenario = scenarios.find(s => s.id === scenarioId);
  const scenarioIndex = scenarios.findIndex(s => s.id === scenarioId);

  useEffect(() => {
    if (scenario && messages.length === 0) {
      // Start with first AI message
      const firstTurn = scenario.dialogue[0];
      setMessages([{
        role: 'ai',
        content: firstTurn.aiMessage,
        timestamp: Date.now()
      }]);
    }
  }, [scenario, messages.length]);

  const handleSendMessage = (content: string) => {
    if (!scenario) return;

    // Handle AI streaming response marker
    if (content.startsWith('__AI_RESPONSE__')) {
      const aiContent = content.replace('__AI_RESPONSE__', '');
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'ai') {
          // Update existing AI message
          return [...prev.slice(0, -1), { ...lastMsg, content: aiContent }];
        } else {
          // Create new AI message
          return [...prev, { role: 'ai', content: aiContent, timestamp: Date.now() }];
        }
      });
      return;
    }

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);

    // Check if we've completed the dialogue
    const nextIndex = currentTurnIndex + 1;
    if (nextIndex >= scenario.dialogue.length) {
      saveScenarioData();
      setTimeout(() => {
        navigate(`/scenario/${currentMode}/${scenarioId}/feedback`);
      }, 1000);
    } else {
      setCurrentTurnIndex(nextIndex);
    }
  };

  const handleSkip = () => {
    handleSendMessage("[Skipped]");
  };

  const saveScenarioData = () => {
    // Save messages to sessionStorage temporarily
    sessionStorage.setItem(`scenario-${scenarioId}`, JSON.stringify(messages));
  };

  const handleModeChange = (newMode: StudyMode) => {
    // Stop any ongoing speech when switching modes
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCurrentMode(newMode);
    navigate(`/scenario/${newMode}/${scenarioId}`, { replace: true });
  };

  if (!scenario) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold">Scenario not found</h2>
          <p className="text-muted-foreground">The scenario "{scenarioId}" doesn't exist.</p>
          <Button onClick={() => navigate(`/scenario/${currentMode}/${scenarios[0].id}`)}>
            Go to First Scenario
          </Button>
        </div>
      </div>
    );
  }

  const ModeComponent = currentMode === 'text' ? TextMode : currentMode === 'voice' ? VoiceMode : AvatarMode;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <img src={logo} alt="Majewski Studio" className="h-8" />
          <div className="flex items-center gap-2">
            <ModuleNavigation currentMode={currentMode} onModeChange={handleModeChange} />
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Learning Modes</DialogTitle>
                  <DialogDescription>
                    Choose how you want to learn about German taxes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">💬</span>
                      Text Mode
                    </h4>
                    <p className="text-sm text-muted-foreground pl-10">
                      Classic chat interface - read and type your responses at your own pace.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">🎤</span>
                      Voice Mode
                    </h4>
                    <p className="text-sm text-muted-foreground pl-10">
                      Hear the AI speak while you type your answers - perfect for multitasking.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">🎥</span>
                      Avatar Mode
                    </h4>
                    <p className="text-sm text-muted-foreground pl-10">
                      Audio-only experience - listen to the AI and respond by typing.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={() => navigate('/post-test')} className="gap-2">
              <LogOut className="w-4 h-4" />
              Finish
            </Button>
          </div>
        </div>
        <ScenarioProgress current={scenarioIndex + 1} total={scenarios.length} />
        <div className="mt-3">
          <h2 className="font-semibold text-lg">{scenario.title}</h2>
          <p className="text-sm text-muted-foreground">{scenario.description}</p>
        </div>
      </header>

      {/* Mode-specific content */}
      <div className="flex-1 overflow-hidden">
        <ModeComponent
          messages={messages}
          onSendMessage={handleSendMessage}
          onSkip={handleSkip}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default Scenario;
