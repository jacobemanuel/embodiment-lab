import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Message, StudyMode, ScenarioData } from "@/types/study";
import { scenarios } from "@/data/scenarios";
import { TextMode } from "@/components/modes/TextMode";
import { VoiceMode } from "@/components/modes/VoiceMode";
import { AvatarMode } from "@/components/modes/AvatarMode";
import { ScenarioProgress } from "@/components/ScenarioProgress";
import logo from "@/assets/logo-white.png";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

const Scenario = () => {
  const { mode, scenarioId } = useParams<{ mode: StudyMode; scenarioId: string }>();
  const navigate = useNavigate();
  
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

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);

    // Simulate AI thinking
    setIsLoading(true);
    
    setTimeout(() => {
      // Move to next dialogue turn
      const nextIndex = currentTurnIndex + 1;
      
      if (nextIndex < scenario.dialogue.length) {
        const nextTurn = scenario.dialogue[nextIndex];
        const aiMessage: Message = {
          role: 'ai',
          content: nextTurn.aiMessage,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMessage]);
        setCurrentTurnIndex(nextIndex);
        setIsLoading(false);
      } else {
        // Scenario complete
        setIsLoading(false);
        saveScenarioData();
        navigate(`/scenario/${mode}/${scenarioId}/feedback`);
      }
    }, 1500);
  };

  const handleSkip = () => {
    handleSendMessage("[Skipped]");
  };

  const saveScenarioData = () => {
    // Save messages to sessionStorage temporarily
    sessionStorage.setItem(`scenario-${scenarioId}`, JSON.stringify(messages));
  };

  if (!scenario) {
    return <div>Scenario not found</div>;
  }

  const ModeComponent = mode === 'text' ? TextMode : mode === 'voice' ? VoiceMode : AvatarMode;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <img src={logo} alt="Wiiniffrare" className="h-8" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground capitalize">{mode} Mode</span>
            <Button variant="ghost" size="icon">
              <HelpCircle className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <ScenarioProgress current={scenarioIndex + 1} total={scenarios.length} />
        <div className="mt-3">
          <h2 className="font-semibold">{scenario.title}</h2>
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
