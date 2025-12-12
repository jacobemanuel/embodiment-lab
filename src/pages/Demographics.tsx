import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import logo from "@/assets/logo-white.png";
import { saveDemographics } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { StudyMode } from "@/types/study";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { Loader2 } from "lucide-react";
import { VerticalProgressBar } from "@/components/VerticalProgressBar";

const Demographics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { questions: demographicQuestions, isLoading: questionsLoading, error } = useStudyQuestions('demographic');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

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
      try {
        let sessionId = sessionStorage.getItem('sessionId');
        
        // If no session exists, create one
        if (!sessionId) {
          const mode = sessionStorage.getItem('studyMode') as StudyMode || 'text';
          const { createStudySession } = await import('@/lib/studyData');
          sessionId = await createStudySession(mode);
          sessionStorage.setItem('sessionId', sessionId);
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
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <img src={logo} alt="Majewski Studio" className="h-8" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Background Information</h1>
            <p className="text-muted-foreground">Help us understand your background</p>
          </div>

          <VerticalProgressBar
            totalQuestions={demographicQuestions.length}
            answeredQuestions={Object.keys(responses).filter(k => responses[k]?.trim()).length}
            questionIds={demographicQuestions.map(q => q.id)}
            responses={responses}
            onQuestionClick={scrollToQuestion}
          />

          <div className="space-y-8">
            {demographicQuestions.map((question, index) => (
              <div 
                key={question.id} 
                ref={el => questionRefs.current[index] = el}
                className="bg-card border border-border rounded-2xl p-6 space-y-4"
              >
                <h3 className="font-semibold">{question.text}</h3>
                
                {/* Text input for age-type questions, radio for others */}
                {isTextInputQuestion(question.text) ? (
                  <div className="space-y-3">
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
                  >
                    <div className="space-y-3">
                      {question.options.map((option) => (
                        <div key={option} className="flex items-center space-x-3">
                          <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                          <Label 
                            htmlFor={`${question.id}-${option}`}
                            className="cursor-pointer flex-1 py-2"
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

          <Button
            size="lg"
            className="w-full"
            onClick={handleContinue}
            disabled={!allQuestionsAnswered || isLoading}
          >
            {isLoading ? "Saving..." : "Continue to Pre-Test"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Demographics;
