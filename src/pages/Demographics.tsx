import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import logo from "@/assets/logo-white.png";
import { saveDemographics } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { StudyMode } from "@/types/study";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { Loader2 } from "lucide-react";
import { VerticalProgressBar } from "@/components/VerticalProgressBar";
import ConsentSidebar from "@/components/ConsentSidebar";
import { useStudyFlowGuard } from "@/hooks/useStudyFlowGuard";
import { useBotDetection, logSuspiciousActivity } from "@/hooks/useBotDetection";

const Demographics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Guard: Ensure user has a valid session (from consent)
  useStudyFlowGuard('demographics');
  
  // Bot detection
  const { recordQuestionStart, recordQuestionAnswer, analyzeTimingData } = useBotDetection({
    pageType: 'demographics',
    onSuspiciousActivity: async (result) => {
      const sessionId = sessionStorage.getItem('sessionId');
      if (sessionId) {
        await logSuspiciousActivity(sessionId, result, 'demographics');
      }
    }
  });
  
  const { questions: demographicQuestions, isLoading: questionsLoading, error } = useStudyQuestions('demographic');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Track when questions are viewed
  useEffect(() => {
    demographicQuestions.forEach(q => {
      recordQuestionStart(q.id);
    });
  }, [demographicQuestions, recordQuestionStart]);

  const scrollToQuestion = (index: number) => {
    questionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Check if all questions are answered
  const allQuestionsAnswered = demographicQuestions.length > 0 && demographicQuestions.every(q => {
    const answer = responses[q.id];
    return answer && answer.trim() !== "";
  });

  const handleContinue = async () => {
    if (allQuestionsAnswered) {
      setIsLoading(true);
      
      // Analyze timing data for bot detection before proceeding
      const botResult = analyzeTimingData();
      
      try {
        const sessionId = sessionStorage.getItem('sessionId');
        
        if (!sessionId) {
          throw new Error('No session ID found');
        }
        
        // Report suspicious activity if detected
        if (botResult.suspicionLevel !== 'none' && sessionId) {
          await logSuspiciousActivity(sessionId, botResult, 'demographics');
        }
        
        // Send responses using question IDs as keys
        await saveDemographics(sessionId, responses);
        sessionStorage.setItem('demographics', JSON.stringify(responses));
        navigate("/pre-test");
      } catch (error) {
        console.error('Error saving demographics:', error);
        toast({
          title: "Error",
          description: "Failed to save your responses. Please try again.",
          variant: "destructive"
        });
        setIsLoading(false);
      }
    }
  };

  // Check if a question should use text input (for age-type questions)
  const isTextInputQuestion = (questionText: string) => {
    const lowerText = questionText.toLowerCase();
    return lowerText.includes('age') || lowerText.includes('wiek');
  };

  if (questionsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error || demographicQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load questions</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ConsentSidebar />
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <img src={logo} alt="Majewski Studio" className="h-8" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2 bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">
              Background Information
            </h1>
            <p className="text-muted-foreground mb-6">Help us understand your background</p>
            
            {/* Progress bar */}
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-ai-primary to-ai-accent transition-all duration-300"
                style={{ width: `${demographicQuestions.length > 0 ? (Object.keys(responses).filter(k => responses[k]?.trim()).length / demographicQuestions.length * 100) : 0}%` }}
              />
            </div>
          </div>

          <VerticalProgressBar
            totalQuestions={demographicQuestions.length}
            answeredQuestions={Object.keys(responses).filter(k => responses[k]?.trim()).length}
            questionIds={demographicQuestions.map(q => q.id)}
            responses={responses}
            onQuestionClick={scrollToQuestion}
          />

          <div className="space-y-6 stagger-fade-in">
            {demographicQuestions.map((question, index) => (
              <div 
                key={question.id} 
                ref={el => questionRefs.current[index] = el}
                className="glass-card rounded-2xl p-6 space-y-4 hover:shadow-ai-glow transition-all duration-300"
              >
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-ai-primary to-ai-accent text-white flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </span>
                  <h3 className="font-semibold pt-1">{question.text}</h3>
                </div>
                
                {/* Text input for age-type questions, radio for others */}
                {isTextInputQuestion(question.text) ? (
                  <div className="pl-11 space-y-3">
                    <Input
                      type="number"
                      placeholder="Enter your age"
                      value={responses[question.id] || ""}
                      onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
                      className="max-w-xs"
                      min="1"
                      max="150"
                    />
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={`prefer-not-${question.id}`}
                        checked={responses[question.id] === "Prefer not to say"}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setResponses(prev => ({ ...prev, [question.id]: "Prefer not to say" }));
                          } else {
                            setResponses(prev => ({ ...prev, [question.id]: "" }));
                          }
                        }}
                      />
                      <Label htmlFor={`prefer-not-${question.id}`} className="cursor-pointer">
                        Prefer not to say
                      </Label>
                    </div>
                  </div>
                ) : (
                  <RadioGroup
                    value={responses[question.id] || ""}
                    onValueChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                    className="pl-11"
                  >
                    <div className="space-y-3">
                      {question.options.map((option) => (
                        <div key={option} className="flex items-center space-x-3 group">
                          <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                          <Label 
                            htmlFor={`${question.id}-${option}`}
                            className="cursor-pointer flex-1 leading-relaxed group-hover:text-foreground transition-colors"
                          >
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                )}
              </div>
            ))}
          </div>

          <div className="sticky bottom-6 glass-card rounded-2xl p-4 shadow-medium">
            <Button
              size="lg"
              className={`w-full transition-all duration-300 ${allQuestionsAnswered ? 'gradient-ai hover:shadow-ai-glow hover:scale-[1.02]' : 'bg-muted text-muted-foreground'}`}
              onClick={handleContinue}
              disabled={!allQuestionsAnswered || isLoading}
            >
              {isLoading 
                ? "Saving..." 
                : allQuestionsAnswered 
                  ? "Continue to Pre-Test" 
                  : `Answer all questions to continue (${Object.keys(responses).filter(k => responses[k]?.trim()).length}/${demographicQuestions.length})`
              }
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Demographics;
