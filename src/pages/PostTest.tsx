import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "@/assets/logo-white.png";
import { postTestQuestions } from "@/data/postTestQuestions";
import { savePostTestResponses, completeStudySession } from "@/lib/studyData";
import { StudyMode } from "@/types/study";
import { useToast } from "@/hooks/use-toast";
import { LikertScale } from "@/components/LikertScale";

const PostTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const allQuestionsAnswered = postTestQuestions.every(q => responses[q.id]);
  const progress = Object.keys(responses).length / postTestQuestions.length * 100;

  const handleComplete = async () => {
    if (allQuestionsAnswered) {
      setIsLoading(true);
      try {
        const sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) throw new Error('Session not found');
        
        const studyMode = (sessionStorage.getItem('studyMode') as StudyMode) || 'text';
        await savePostTestResponses(sessionId, responses, { includeTelemetry: true, mode: studyMode });
        await completeStudySession(sessionId);
        
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
            {Object.keys(responses).length} of {postTestQuestions.length} answered
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Post-Test Assessment</h1>
            <p className="text-muted-foreground mb-6">
              Please share your experience and assess your knowledge about AI image generation.
            </p>
            
            {/* Progress bar */}
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Group questions by category */}
          <div className="space-y-8">
            {/* Trust Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-primary">Trust & Credibility</h2>
              {postTestQuestions.filter(q => q.category === 'trust' && q.type === 'likert').map((question, index) => (
                <div key={question.id} className="bg-card border border-border rounded-2xl p-6 space-y-5">
                  <h3 className="font-medium text-lg">{question.text}</h3>
                  <LikertScale
                    id={question.id}
                    value={responses[question.id] || ""}
                    onChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                  />
                </div>
              ))}
            </div>

            {/* Engagement Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-primary">Engagement</h2>
              {postTestQuestions.filter(q => q.category === 'engagement' && q.type === 'likert').map((question) => (
                <div key={question.id} className="bg-card border border-border rounded-2xl p-6 space-y-5">
                  <h3 className="font-medium text-lg">{question.text}</h3>
                  <LikertScale
                    id={question.id}
                    value={responses[question.id] || ""}
                    onChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                  />
                </div>
              ))}
            </div>

            {/* Satisfaction Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-primary">Overall Satisfaction</h2>
              {postTestQuestions.filter(q => q.category === 'satisfaction' && q.type === 'likert').map((question) => (
                <div key={question.id} className="bg-card border border-border rounded-2xl p-6 space-y-5">
                  <h3 className="font-medium text-lg">{question.text}</h3>
                  <LikertScale
                    id={question.id}
                    value={responses[question.id] || ""}
                    onChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                  />
                </div>
              ))}
            </div>

            {/* Knowledge Check Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-primary">Knowledge Check</h2>
              {postTestQuestions.filter(q => q.category === 'knowledge').map((question, index) => (
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
                  ? "Complete Study" 
                  : `Answer all questions to continue (${Object.keys(responses).length}/${postTestQuestions.length})`
              }
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PostTest;
