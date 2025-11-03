import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "@/assets/logo-white.png";
import { preTestQuestions } from "@/data/questions";
import { savePreTestResponses } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";

const PreTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const allQuestionsAnswered = preTestQuestions.every(q => responses[q.id]);
  const progress = Object.keys(responses).length / preTestQuestions.length * 100;

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <img src={logo} alt="Wiiniffrare" className="h-8" />
          <div className="text-sm text-muted-foreground">
            {Object.keys(responses).length} of {preTestQuestions.length} answered
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Pre-Test Assessment</h1>
            <p className="text-muted-foreground mb-6">
              Please answer these questions based on your current knowledge. Don't worry if you're not sure—this helps us measure learning gains.
            </p>
            
            {/* Progress bar */}
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-6">
            {preTestQuestions.map((question, index) => (
              <div key={question.id} className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
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
                      <div key={option} className="flex items-start space-x-3">
                        <RadioGroupItem 
                          value={option} 
                          id={`${question.id}-${option}`}
                          className="mt-0.5"
                        />
                        <Label 
                          htmlFor={`${question.id}-${option}`}
                          className="cursor-pointer flex-1 py-1 leading-relaxed"
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

          <div className="sticky bottom-6 bg-background/95 backdrop-blur-sm border border-border rounded-2xl p-4 shadow-medium">
            <Button
              size="lg"
              className="w-full"
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
