import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import logo from "@/assets/logo-white.png";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { savePreTestResponses } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { VerticalProgressBar } from "@/components/VerticalProgressBar";

const PreTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { questions: preTestQuestions, isLoading: questionsLoading, error } = useStudyQuestions('pre_test');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scrollToQuestion = (index: number) => {
    questionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const allQuestionsAnswered = preTestQuestions.length > 0 && preTestQuestions.every(q => responses[q.id]);
  const progress = preTestQuestions.length > 0 ? Object.keys(responses).length / preTestQuestions.length * 100 : 0;

  const handleContinue = async () => {
    if (allQuestionsAnswered) {
      setIsLoading(true);
      try {
        const sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) throw new Error('Session not found');
        
        await savePreTestResponses(sessionId, responses);
        sessionStorage.setItem('preTest', JSON.stringify(responses));
        navigate("/mode-assignment");
      } catch (error) {
        console.error('Error saving pre-test:', error);
        toast({
          title: "Error",
          description: "Failed to save your responses. Please try again.",
          variant: "destructive"
        });
        setIsLoading(false);
      }
    }
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

  if (error || preTestQuestions.length === 0) {
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
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <img src={logo} alt="TUM Logo" className="h-8" />
          <div className="text-sm text-muted-foreground">
            {Object.keys(responses).length} of {preTestQuestions.length} answered
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2 bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">
              Pre-Test Assessment
            </h1>
            <p className="text-muted-foreground mb-6">
              Please answer these questions about AI image generation based on your current knowledge. Don't worry if you're not sure—this helps us measure learning gains.
            </p>
            
            {/* Progress bar */}
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-ai-primary to-ai-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <VerticalProgressBar
            totalQuestions={preTestQuestions.length}
            answeredQuestions={Object.keys(responses).length}
            questionIds={preTestQuestions.map(q => q.id)}
            responses={responses}
            onQuestionClick={scrollToQuestion}
          />

          <div className="space-y-6 stagger-fade-in">
            {preTestQuestions.map((question, index) => (
              <div 
                key={question.id} 
                ref={el => questionRefs.current[index] = el}
                className="glass-card rounded-2xl p-6 space-y-4 hover:shadow-ai-glow transition-all duration-300"
              >
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-ai-primary to-ai-accent text-white flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </span>
                  <h3 className="font-semibold flex-1 pt-1">{question.text}</h3>
                </div>
                <RadioGroup
                  value={responses[question.id] || ""}
                  onValueChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                  className="pl-11"
                >
                  <div className="space-y-3">
                    {question.options.map((option) => (
                      <div key={option} className="flex items-start space-x-3 group">
                        <RadioGroupItem 
                          value={option} 
                          id={`${question.id}-${option}`}
                          className="mt-0.5"
                        />
                        <Label 
                          htmlFor={`${question.id}-${option}`}
                          className="cursor-pointer flex-1 py-1 leading-relaxed group-hover:text-foreground transition-colors"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            ))}
          </div>

          <div className="sticky bottom-6 glass-card rounded-2xl p-4 shadow-medium">
            <Button
              size="lg"
              className="w-full gradient-ai hover:shadow-ai-glow transition-all duration-300 hover:scale-[1.02]"
              onClick={handleContinue}
              disabled={!allQuestionsAnswered || isLoading}
            >
              {isLoading 
                ? "Saving..." 
                : allQuestionsAnswered 
                  ? "Continue to Learning Scenarios" 
                  : `Answer all questions to continue (${Object.keys(responses).length}/${preTestQuestions.length})`
              }
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PreTest;
