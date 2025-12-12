import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "@/assets/logo-white.png";
import { saveDemographics } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { StudyMode } from "@/types/study";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { Loader2 } from "lucide-react";

const Demographics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { questions: demographicQuestions, isLoading: questionsLoading, error } = useStudyQuestions('demographic');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [preferNotToSayAge, setPreferNotToSayAge] = useState(false);
  const [ageValue, setAgeValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Find specific question types
  const ageQuestion = demographicQuestions.find(q => q.id.includes('age') || q.text.toLowerCase().includes('age'));
  const otherQuestions = demographicQuestions.filter(q => q !== ageQuestion);

  const allQuestionsAnswered = demographicQuestions.length > 0 && demographicQuestions.every(q => {
    if (q === ageQuestion) {
      return ageValue.trim() !== "" || preferNotToSayAge;
    }
    return responses[q.id];
  });

  const handleContinue = async () => {
    if (allQuestionsAnswered) {
      setIsLoading(true);
      try {
        let sessionId = sessionStorage.getItem('sessionId');
        
        // If no session exists, create one
        if (!sessionId) {
          const mode = sessionStorage.getItem('studyMode') as StudyMode || 'text';
          
          // Create session in database (server generates secure ID)
          const { createStudySession } = await import('@/lib/studyData');
          sessionId = await createStudySession(mode);
          sessionStorage.setItem('sessionId', sessionId);
        }
        
        // Build responses object with proper column mapping
        const demographicResponses: Record<string, string> = {};
        
        // Handle age question
        if (ageQuestion) {
          demographicResponses['age_range'] = preferNotToSayAge ? "Prefer not to say" : ageValue;
        }
        
        // Handle other questions - map to database columns
        otherQuestions.forEach(q => {
          if (responses[q.id]) {
            // Map question IDs to database column names
            if (q.id.includes('education') || q.text.toLowerCase().includes('education')) {
              demographicResponses['education'] = responses[q.id];
            } else if (q.id.includes('digital') || q.id.includes('experience') || q.text.toLowerCase().includes('experience')) {
              demographicResponses['digital_experience'] = responses[q.id];
            } else {
              // For any other questions, use the question id as key
              demographicResponses[q.id] = responses[q.id];
            }
          }
        });
        
        await saveDemographics(sessionId, demographicResponses);
        sessionStorage.setItem('demographics', JSON.stringify(demographicResponses));
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

          <div className="space-y-8">
            {/* Age Question - Special handling with text input */}
            {ageQuestion && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold">{ageQuestion.text}</h3>
                <div className="space-y-3">
                  <Input
                    type="number"
                    placeholder="Enter your age"
                    value={ageValue}
                    onChange={(e) => {
                      setAgeValue(e.target.value);
                      if (e.target.value) setPreferNotToSayAge(false);
                    }}
                    disabled={preferNotToSayAge}
                    className="max-w-xs"
                    min="1"
                    max="150"
                  />
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="prefer-not-age"
                      checked={preferNotToSayAge}
                      onCheckedChange={(checked) => {
                        setPreferNotToSayAge(checked === true);
                        if (checked) setAgeValue("");
                      }}
                    />
                    <Label htmlFor="prefer-not-age" className="cursor-pointer">
                      Prefer not to say
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* Other Questions - Radio buttons */}
            {otherQuestions.map((question) => (
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
