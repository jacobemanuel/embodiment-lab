import { Button } from "@/components/ui/button";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import logo from "@/assets/logo-white.png";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { savePostTestResponses, completeStudySession } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { VerticalProgressBar } from "@/components/VerticalProgressBar";

const PostTestPage2 = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { questions: postTestQuestions, isLoading: questionsLoading, error } = useStudyQuestions('post_test');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scrollToQuestion = (index: number) => {
    questionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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

  // Filter knowledge questions from post_test
  // Filter knowledge questions from post_test
  const knowledgeQuestions = postTestQuestions.filter(q => q.category === 'knowledge');
  // Count questions that have at least one answer (not empty string)
  const answeredQuestionsCount = knowledgeQuestions.filter(q => responses[q.id] && responses[q.id].trim() !== '').length;
  const allQuestionsAnswered = knowledgeQuestions.length > 0 && answeredQuestionsCount === knowledgeQuestions.length;
  const progress = knowledgeQuestions.length > 0 ? answeredQuestionsCount / knowledgeQuestions.length * 100 : 0;

  // Handle checkbox toggle for multiple-answer questions
  const handleMultipleAnswerToggle = (questionId: string, option: string) => {
    const currentAnswer = responses[questionId] || '';
    const currentAnswers = currentAnswer ? currentAnswer.split('|||') : [];
    
    if (currentAnswers.includes(option)) {
      // Remove option
      const newAnswers = currentAnswers.filter(a => a !== option);
      setResponses(prev => ({
        ...prev,
        [questionId]: newAnswers.join('|||')
      }));
    } else {
      // Add option
      const newAnswers = [...currentAnswers, option];
      setResponses(prev => ({
        ...prev,
        [questionId]: newAnswers.join('|||')
      }));
    }
  };

  const handleComplete = async () => {
    if (allQuestionsAnswered) {
      setIsLoading(true);
      try {
        let sessionId = sessionStorage.getItem('sessionId');

        // If session was lost (e.g. new tab / cleared storage), force a restart
        if (!sessionId) {
          console.error('Session not found when completing study');
          toast({
            title: "Session expired",
            description: "We need to restart the study to save your results.",
            variant: "destructive",
          });
          // Clean up any partial post-test data
          sessionStorage.removeItem('postTestPage1');
          sessionStorage.removeItem('postTestPage2');
          sessionStorage.removeItem('postTest1');
          setIsLoading(false);
          navigate("/");
          return;
        }
        
        // Combine all responses from both pages
        const allResponses = {
          ...page1Responses,
          ...responses
        };
        
        await savePostTestResponses(sessionId, allResponses);
        await completeStudySession(sessionId);
        
        // Clear sessionStorage for post-test data
        sessionStorage.removeItem('postTestPage1');
        sessionStorage.removeItem('postTestPage2');
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

  if (error || knowledgeQuestions.length === 0) {
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
          <img src={logo} alt="Majewski Studio" className="h-8" />
          <div className="text-sm text-muted-foreground">
            Page 2 of 2 • {answeredQuestionsCount} of {knowledgeQuestions.length} answered
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2 bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">
              Knowledge Check!
            </h1>
            <p className="text-muted-foreground mb-2">
              Time to test what you've learned about AI image generation. Don't worry - there's no grade!
            </p>
            <p className="text-muted-foreground/60 text-sm mb-6">
              You may select multiple answers if you believe more than one is correct.
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
            totalQuestions={knowledgeQuestions.length}
            answeredQuestions={answeredQuestionsCount}
            questionIds={knowledgeQuestions.map(q => q.id)}
            responses={responses}
            onQuestionClick={scrollToQuestion}
          />

          <div className="space-y-6 stagger-fade-in">
            {knowledgeQuestions.map((question, index) => {
              const selectedAnswers = responses[question.id] ? responses[question.id].split('|||') : [];
              
              return (
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
                  
                  <div className="pl-11 space-y-3">
                    {question.options.map((option) => (
                      <div 
                        key={option} 
                        className="flex items-center space-x-3 group cursor-pointer"
                        onClick={() => handleMultipleAnswerToggle(question.id, option)}
                      >
                        <Checkbox 
                          checked={selectedAnswers.includes(option)}
                          onCheckedChange={() => handleMultipleAnswerToggle(question.id, option)}
                          id={`${question.id}-${option}`}
                        />
                        <Label 
                          htmlFor={`${question.id}-${option}`}
                          className="cursor-pointer flex-1 leading-relaxed group-hover:text-foreground transition-colors"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-6 glass-card rounded-2xl p-4 shadow-medium">
            <Button
              size="lg"
              className={`w-full transition-all duration-300 ${allQuestionsAnswered ? 'gradient-ai hover:shadow-ai-glow hover:scale-[1.02]' : 'bg-muted text-muted-foreground'}`}
              onClick={handleComplete}
              disabled={!allQuestionsAnswered || isLoading}
            >
              {isLoading 
                ? "Saving..." 
                : allQuestionsAnswered 
                  ? "Complete Study 🎉" 
                  : `Answer all questions to continue (${answeredQuestionsCount}/${knowledgeQuestions.length})`
              }
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PostTestPage2;
