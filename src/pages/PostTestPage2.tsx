import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import logo from "@/assets/logo-white.png";
import { postTestQuestions } from "@/data/postTestQuestions";
import { savePostTestResponses, completeStudySession } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

const PostTestPage2 = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Load page 1 responses from sessionStorage
  const page1Responses = JSON.parse(sessionStorage.getItem('postTestPage1') || '{}');

  // Load existing page 2 responses
  useEffect(() => {
    const saved = sessionStorage.getItem('postTestPage2');
    if (saved) {
      setResponses(JSON.parse(saved));
    }
  }, []);

  // Save to sessionStorage whenever responses change
  useEffect(() => {
    if (Object.keys(responses).length > 0) {
      sessionStorage.setItem('postTestPage2', JSON.stringify(responses));
    }
  }, [responses]);

  const knowledgeQuestions = postTestQuestions.filter(q => q.category === 'knowledge');
  const allQuestionsAnswered = knowledgeQuestions.every(q => responses[q.id]);
  const progress = Object.keys(responses).length / knowledgeQuestions.length * 100;

  const handleComplete = async () => {
    if (allQuestionsAnswered) {
      setIsLoading(true);
      try {
        const sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) throw new Error('Session not found');
        
        // Combine all responses from both pages
        const allResponses = {
          ...page1Responses,
          ...responses
        };
        
        await savePostTestResponses(sessionId, allResponses);
        await completeStudySession(sessionId);
        
        // Clear sessionStorage
        sessionStorage.removeItem('postTestPage1');
        sessionStorage.removeItem('postTestPage2');
        
        navigate("/completion");
      } catch (error) {
        console.error('Error completing study:', error);
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
          <img src={logo} alt="Majewski Studio" className="h-8" />
          <div className="text-sm text-muted-foreground">
            Page 2 of 2 • {Object.keys(responses).length} of {knowledgeQuestions.length} answered
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-3xl">
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-semibold">Bonus Knowledge Check!</h1>
            </div>
            <p className="text-muted-foreground mb-6">
              Time to test what you've learned about German taxes. Don't worry - there's no grade!
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
            {knowledgeQuestions.map((question, index) => (
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
                      <div key={option} className="flex items-start space-x-3 bg-secondary/30 rounded-lg p-3 hover:bg-secondary/50 transition-colors">
                        <RadioGroupItem 
                          value={option} 
                          id={`${question.id}-${option}`}
                          className="mt-0.5"
                        />
                        <Label 
                          htmlFor={`${question.id}-${option}`}
                          className="cursor-pointer flex-1 leading-relaxed"
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
              onClick={handleComplete}
              disabled={!allQuestionsAnswered || isLoading}
            >
              {isLoading 
                ? "Saving..." 
                : allQuestionsAnswered 
                  ? "Complete Study 🎉" 
                  : `Answer all questions to continue (${Object.keys(responses).length}/${knowledgeQuestions.length})`
              }
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PostTestPage2;
