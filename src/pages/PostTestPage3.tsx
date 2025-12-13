import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import logo from "@/assets/logo-white.png";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { savePostTestResponses, completeStudySession } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, SkipForward, ChevronLeft } from "lucide-react";
import { VerticalProgressBar } from "@/components/VerticalProgressBar";
import ConsentSidebar from "@/components/ConsentSidebar";

const MAX_CHARS = 200;
const SKIP_VALUE = '__SKIPPED__';

const PostTestPage3 = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { questions: postTestQuestions, isLoading: questionsLoading, error } = useStudyQuestions('post_test');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scrollToQuestion = (index: number) => {
    questionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Load page 1 and 2 responses from sessionStorage
  const page1Responses = JSON.parse(sessionStorage.getItem('postTestPage1') || '{}');
  const page2Responses = JSON.parse(sessionStorage.getItem('postTestPage2') || '{}');
  
  // Load existing page 3 responses
  useEffect(() => {
    const saved = sessionStorage.getItem('postTestPage3');
    if (saved) {
      setResponses(JSON.parse(saved));
    }
  }, []);

  // Save to sessionStorage whenever responses change
  useEffect(() => {
    if (Object.keys(responses).length > 0) {
      sessionStorage.setItem('postTestPage3', JSON.stringify(responses));
    }
  }, [responses]);

  // Filter open feedback questions
  const openFeedbackQuestions = postTestQuestions.filter(q => q.category === 'open_feedback');
  
  // Count answered OR skipped questions
  const answeredQuestionsCount = openFeedbackQuestions.filter(q => 
    responses[q.id] && responses[q.id].trim() !== ''
  ).length;
  
  // All questions are "handled" if answered or skipped
  const allQuestionsHandled = openFeedbackQuestions.length > 0 && 
    openFeedbackQuestions.every(q => responses[q.id] && responses[q.id].trim() !== '');
  
  const progress = openFeedbackQuestions.length > 0 
    ? answeredQuestionsCount / openFeedbackQuestions.length * 100 
    : 0;

  const handleSkipToggle = (questionId: string) => {
    setResponses(prev => {
      const current = prev[questionId];
      if (current === SKIP_VALUE) {
        // Uncheck - remove the skip
        const { [questionId]: _, ...rest } = prev;
        return rest;
      } else {
        // Check - set to skip value
        return { ...prev, [questionId]: SKIP_VALUE };
      }
    });
  };

  const handleTextChange = (questionId: string, value: string) => {
    // Enforce max chars
    if (value.length <= MAX_CHARS) {
      setResponses(prev => ({
        ...prev,
        [questionId]: value
      }));
    }
  };

  const handleComplete = async () => {
    if (allQuestionsHandled) {
      setIsLoading(true);
      try {
        let sessionId = sessionStorage.getItem('sessionId');

        if (!sessionId) {
          console.error('Session not found when completing study');
          toast({
            title: "Session expired",
            description: "We need to restart the study to save your results.",
            variant: "destructive",
          });
          sessionStorage.removeItem('postTestPage1');
          sessionStorage.removeItem('postTestPage2');
          sessionStorage.removeItem('postTestPage3');
          sessionStorage.removeItem('postTest1');
          setIsLoading(false);
          navigate("/");
          return;
        }
        
        // Combine all responses from all pages
        const allResponses = {
          ...page1Responses,
          ...page2Responses,
          ...responses
        };
        
        await savePostTestResponses(sessionId, allResponses);
        await completeStudySession(sessionId);
        
        // Clear sessionStorage for post-test data
        sessionStorage.removeItem('postTestPage1');
        sessionStorage.removeItem('postTestPage2');
        sessionStorage.removeItem('postTestPage3');
        sessionStorage.removeItem('postTest1');
        
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

  if (error || openFeedbackQuestions.length === 0) {
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
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/post-test-2')}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <img src={logo} alt="Majewski Studio" className="h-8" />
          </div>
          <div className="text-sm text-muted-foreground">
            Page 3 of 3 • {answeredQuestionsCount} of {openFeedbackQuestions.length} answered
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="w-8 h-8 text-ai-primary" />
              <h1 className="text-3xl font-semibold bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">
                Your Feedback
              </h1>
            </div>
            <p className="text-muted-foreground mb-6">
              Almost done! Share your thoughts about your learning experience. You can skip any question if you prefer.
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
            totalQuestions={openFeedbackQuestions.length}
            answeredQuestions={answeredQuestionsCount}
            questionIds={openFeedbackQuestions.map(q => q.id)}
            responses={responses}
            onQuestionClick={scrollToQuestion}
          />

          <div className="space-y-6 stagger-fade-in">
            {openFeedbackQuestions.map((question, index) => {
              const currentValue = responses[question.id] || '';
              const isSkipped = currentValue === SKIP_VALUE;
              const displayValue = isSkipped ? '' : currentValue;
              const charsRemaining = MAX_CHARS - displayValue.length;
              
              return (
                <div 
                  key={question.id} 
                  ref={el => questionRefs.current[index] = el}
                  className={`glass-card rounded-2xl p-6 space-y-4 transition-all duration-300 ${isSkipped ? 'opacity-60' : 'hover:shadow-ai-glow'}`}
                >
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-ai-primary to-ai-accent text-white flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </span>
                    <Label className="font-semibold pt-1 text-base">{question.text}</Label>
                  </div>
                  
                  <div className="pl-11 space-y-3">
                    <Textarea 
                      value={displayValue}
                      onChange={(e) => handleTextChange(question.id, e.target.value)}
                      placeholder="Type your answer here..."
                      className="min-h-[100px] resize-none bg-background/50 border-border/50 focus:border-ai-primary transition-colors"
                      maxLength={MAX_CHARS}
                      disabled={isSkipped}
                    />
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => handleSkipToggle(question.id)}
                      >
                        <Checkbox 
                          checked={isSkipped}
                          onCheckedChange={() => handleSkipToggle(question.id)}
                          id={`skip-${question.id}`}
                        />
                        <label 
                          htmlFor={`skip-${question.id}`}
                          className="text-sm text-muted-foreground cursor-pointer group-hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <SkipForward className="w-3 h-3" />
                          Skip this question
                        </label>
                      </div>
                      {!isSkipped && (
                        <div className={`text-xs ${charsRemaining < 20 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {charsRemaining} characters remaining
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-6 glass-card rounded-2xl p-4 shadow-medium">
            <Button
              size="lg"
              className={`w-full transition-all duration-300 ${allQuestionsHandled ? 'gradient-ai hover:shadow-ai-glow hover:scale-[1.02]' : 'bg-muted text-muted-foreground'}`}
              onClick={handleComplete}
              disabled={!allQuestionsHandled || isLoading}
            >
              {isLoading 
                ? "Saving..." 
                : allQuestionsHandled 
                  ? "Complete Study" 
                  : `Answer or skip all questions (${answeredQuestionsCount}/${openFeedbackQuestions.length})`
              }
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PostTestPage3;
