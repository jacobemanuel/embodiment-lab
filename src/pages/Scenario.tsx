import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Message, StudyMode, ScenarioData } from "@/types/study";
import { scenarios } from "@/data/scenarios";
import { TextMode } from "@/components/modes/TextMode";
import { AvatarMode } from "@/components/modes/AvatarMode";
import { ImagePlayground } from "@/components/ImagePlayground";
import { ScenarioProgress } from "@/components/ScenarioProgress";
import { ModuleNavigation } from "@/components/ModuleNavigation";
import logo from "@/assets/logo-white.png";
import { Button } from "@/components/ui/button";
import { HelpCircle, LogOut, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [isPlaygroundVisible, setIsPlaygroundVisible] = useState(false);
  const [shouldPulseButton, setShouldPulseButton] = useState(false);

  // Start pulsing the button after 3 seconds to encourage discovery
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isPlaygroundVisible) {
        setShouldPulseButton(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isPlaygroundVisible]);

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

  const ModeComponent = currentMode === 'text' ? TextMode : AvatarMode;

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
                    Choose how you want to learn about AI image generation
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
                      <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">🎥</span>
                      Avatar Mode
                    </h4>
                    <p className="text-sm text-muted-foreground pl-10">
                      Learn with a visual AI tutor that guides you through the concepts.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-primary-foreground">✨</span>
                      AI Playground
                    </h4>
                    <p className="text-sm text-muted-foreground pl-10">
                      Generate images in real-time while learning - practice what you're being taught!
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

      {/* Main Content Area - Split View on desktop, Full view on mobile */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* Learning Content - Full width on mobile, half width on desktop when playground is open */}
        <div className={`${isPlaygroundVisible ? 'md:w-1/2 w-full' : 'w-full'} transition-all duration-300 md:border-r border-border`}>
          <ModeComponent
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </div>

        {/* AI Playground - Full screen overlay on mobile, side panel on desktop */}
        {isPlaygroundVisible && (
          <>
            {/* Desktop version - side by side */}
            <div className="hidden md:block md:w-1/2 overflow-auto bg-gradient-to-br from-card/50 to-background/50">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                  <h3 className="font-semibold text-lg">AI Image Playground</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Practice what you're learning! Generate images while following the lesson.
                </p>
                
                <ImagePlayground 
                  isOpen={true} 
                  onClose={() => {}} 
                  embedded={true}
                />
              </div>
            </div>

            {/* Mobile version - full screen overlay */}
            <div className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
              <div className="h-full overflow-auto">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                      <h3 className="font-semibold text-base">AI Image Playground</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsPlaygroundVisible(false)}
                      className="text-muted-foreground"
                    >
                      Close
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Practice what you're learning! Generate images while following the lesson.
                  </p>
                  
                  <ImagePlayground 
                    isOpen={true} 
                    onClose={() => {}} 
                    embedded={true}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Toggle Button - Hidden on mobile when playground is open */}
        <Button
          variant="ghost"
          size="icon"
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-l-lg rounded-r-none bg-card/90 backdrop-blur-sm border border-r-0 border-border shadow-lg hover:bg-card transition-all h-16 w-12 ${
            shouldPulseButton && !isPlaygroundVisible ? 'animate-attention-pulse border-primary/70' : ''
          } ${isPlaygroundVisible ? 'md:block hidden' : 'block'}`}
          onClick={() => {
            setIsPlaygroundVisible(!isPlaygroundVisible);
            setShouldPulseButton(false);
          }}
          title={isPlaygroundVisible ? "Hide AI Playground" : "Open AI Playground"}
        >
          {isPlaygroundVisible ? <ChevronRight className="w-8 h-8" /> : <ChevronLeft className="w-8 h-8" />}
        </Button>
      </div>
    </div>
  );
};

export default Scenario;
