import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "@/assets/logo-white.png";
import { demographicQuestions } from "@/data/questions";
import { saveDemographics } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { StudyMode } from "@/types/study";

const Demographics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const allQuestionsAnswered = demographicQuestions.every(q => responses[q.id]);

  const handleContinue = async () => {
    if (allQuestionsAnswered) {
      setIsLoading(true);
      try {
        let sessionId = sessionStorage.getItem('sessionId');
        
        // If no session exists, create one
        if (!sessionId) {
          sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          sessionStorage.setItem('sessionId', sessionId);
          const mode = sessionStorage.getItem('studyMode') as StudyMode || 'text';
          
          // Create session in database
          const { createStudySession } = await import('@/lib/studyData');
          await createStudySession(sessionId, mode);
        }
        
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <img src={logo} alt="Wiiniffrare" className="h-8" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Background Information</h1>
            <p className="text-muted-foreground">Help us understand your background (optional)</p>
          </div>

          <div className="space-y-8">
            {demographicQuestions.map((question) => (
              <div key={question.id} className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold">{question.text}</h3>
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
