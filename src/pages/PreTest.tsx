import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import logo from "@/assets/logo-white.png";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { savePreTestResponses } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { VerticalProgressBar } from "@/components/VerticalProgressBar";
import ConsentSidebar from "@/components/ConsentSidebar";
import { useStudyFlowGuard } from "@/hooks/useStudyFlowGuard";
import { useBotDetection, logSuspiciousActivity } from "@/hooks/useBotDetection";
import ExitStudyButton from "@/components/ExitStudyButton";
import ParticipantFooter from "@/components/ParticipantFooter";

const PreTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Guard: Ensure user completed demographics first
  useStudyFlowGuard('pretest');
  
  // Bot detection
  const { recordQuestionStart, recordQuestionAnswer, analyzeTimingData } = useBotDetection({
    pageType: 'pretest',
    onSuspiciousActivity: async (result) => {
      const sessionId = sessionStorage.getItem('sessionId');
      if (sessionId) {
        await logSuspiciousActivity(sessionId, result, 'pretest');
      }
    }
  });
  
  const { questions: preTestQuestions, isLoading: questionsLoading, error } = useStudyQuestions('pre_test');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Track when questions are viewed - use stable ref to avoid recreation
  useEffect(() => {
    if (preTestQuestions.length > 0) {
      preTestQuestions.forEach(q => {
        recordQuestionStart(q.id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preTestQuestions.length]);

  useEffect(() => {
    if (preTestQuestions.length === 0) return;
    if (sessionStorage.getItem('preTestQuestionsSnapshot')) return;
    const snapshot = preTestQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      category: q.category,
      type: q.type,
      options: q.options,
    }));
    sessionStorage.setItem('preTestQuestionsSnapshot', JSON.stringify(snapshot));
  }, [preTestQuestions]);

  const scrollToQuestion = (index: number) => {
    questionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Count questions that have at least one answer (not empty string)
  const answeredQuestionsCount = preTestQuestions.filter(q => responses[q.id] && responses[q.id].trim() !== '').length;
  const allQuestionsAnswered = preTestQuestions.length > 0 && answeredQuestionsCount === preTestQuestions.length;
  const progress = preTestQuestions.length > 0 ? answeredQuestionsCount / preTestQuestions.length * 100 : 0;

  // Handle checkbox toggle for multiple-answer questions
  const handleMultipleAnswerToggle = (questionId: string, option: string) => {
    recordQuestionAnswer(questionId);
    const currentAnswer = responses[questionId] || '';
    const currentAnswers = currentAnswer ? currentAnswer.split('|||') : [];
    
    if (currentAnswers.includes(option)) {
      const newAnswers = currentAnswers.filter(a => a !== option);
      setResponses(prev => ({
        ...prev,
        [questionId]: newAnswers.join('|||')
      }));
    } else {
      const newAnswers = [...currentAnswers, option];
      setResponses(prev => ({
        ...prev,
        [questionId]: newAnswers.join('|||')
      }));
    }
  };

  const handleContinue = async () => {
    if (allQuestionsAnswered) {
      setIsLoading(true);
      
      // Analyze timing for bot detection
      const botResult = analyzeTimingData();
      
      try {
        const sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) throw new Error('Session not found');
        
        // Report suspicious activity if detected
        if (botResult.suspicionLevel !== 'none') {
          await logSuspiciousActivity(sessionId, botResult, 'pretest');
        }
        
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
      <ConsentSidebar />
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <img src={logo} alt="TUM Logo" className="h-8" />
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {answeredQuestionsCount} of {preTestQuestions.length} answered
            </div>
            <ExitStudyButton />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2 bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">
              Pre-Test Assessment
            </h1>
            <p className="text-muted-foreground mb-2 text-justify">
              Please answer these questions about AI image generation based on your current knowledge. Don't worry if you're not sure—this helps us measure learning gains.
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
            totalQuestions={preTestQuestions.length}
            answeredQuestions={answeredQuestionsCount}
            questionIds={preTestQuestions.map(q => q.id)}
            responses={responses}
            onQuestionClick={scrollToQuestion}
          />

          <div className="space-y-6 stagger-fade-in">
            {preTestQuestions.map((question, index) => {
              const isMultipleAnswer = question.allowMultiple;
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
              onClick={handleContinue}
              disabled={!allQuestionsAnswered || isLoading}
            >
              {isLoading 
                ? "Saving..." 
                : allQuestionsAnswered 
                  ? "Continue to Learning Scenarios" 
                  : `Answer all questions to continue (${answeredQuestionsCount}/${preTestQuestions.length})`
              }
            </Button>
          </div>
        </div>
      </main>
      <ParticipantFooter />
    </div>
  );
};

export default PreTest;
