import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import logo from "@/assets/logo-white.png";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { savePostTestResponses, completeStudySession, saveTutorDialogue } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, ChevronLeft } from "lucide-react";
import { VerticalProgressBar } from "@/components/VerticalProgressBar";
import ConsentSidebar from "@/components/ConsentSidebar";
import { useStudyFlowGuard } from "@/hooks/useStudyFlowGuard";
import ExitStudyButton from "@/components/ExitStudyButton";
import ParticipantFooter from "@/components/ParticipantFooter";
import { StudyMode } from "@/types/study";
import { getTutorDialogueLog } from "@/lib/tutorDialogue";

const MIN_CHARS = 10;
const MAX_CHARS = 50;

const PostTestPage3 = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Guard: Ensure user completed post-test page 2
  useStudyFlowGuard('posttest3');
  
  const { questions: postTestQuestions, isLoading: questionsLoading, error } = useStudyQuestions('post_test');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (postTestQuestions.length === 0) return;
    if (sessionStorage.getItem('postTestQuestionsSnapshot')) return;
    const snapshot = postTestQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      category: q.category,
      type: q.type,
      options: q.options,
    }));
    sessionStorage.setItem('postTestQuestionsSnapshot', JSON.stringify(snapshot));
  }, [postTestQuestions]);

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
  const hasOpenFeedback = openFeedbackQuestions.length > 0;
  
  // Check if answer meets minimum length requirement
  const isValidAnswer = (text: string) => text.trim().length >= MIN_CHARS;
  
  // Count valid answered questions (minimum 10 chars)
  const answeredQuestionsCount = openFeedbackQuestions.filter(q => 
    responses[q.id] && isValidAnswer(responses[q.id])
  ).length;
  
  // All questions are "handled" if answered with minimum chars
  const allQuestionsHandled = hasOpenFeedback
    ? openFeedbackQuestions.every(q => responses[q.id] && isValidAnswer(responses[q.id]))
    : true;
  
  const progress = hasOpenFeedback
    ? answeredQuestionsCount / openFeedbackQuestions.length * 100 
    : 100;

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

        const dialogueLog = getTutorDialogueLog().map(({ role, content, timestamp, slideId, slideTitle }) => ({
          role,
          content,
          timestamp,
          slideId,
          slideTitle,
        }));
        const studyMode = (sessionStorage.getItem('studyMode') as StudyMode) || 'text';
        if (dialogueLog.length > 0) {
          try {
            await saveTutorDialogue(sessionId, studyMode, dialogueLog);
          } catch (dialogueError) {
            console.error('Failed to save tutor dialogue:', dialogueError);
          }
        }
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

  if (error) {
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
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {hasOpenFeedback
                ? `Page 3 of 3 • ${answeredQuestionsCount} of ${openFeedbackQuestions.length} answered`
                : 'Page 3 of 3 • No open feedback questions configured'}
            </div>
            <ExitStudyButton />
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
            <p className="text-muted-foreground mb-6 text-justify">
              Almost done! Share your thoughts about your learning experience.
            </p>
            
            {/* Progress bar */}
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-ai-primary to-ai-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {hasOpenFeedback && (
            <VerticalProgressBar
              totalQuestions={openFeedbackQuestions.length}
              answeredQuestions={answeredQuestionsCount}
              questionIds={openFeedbackQuestions.map(q => q.id)}
              responses={responses}
              onQuestionClick={scrollToQuestion}
            />
          )}

          <div className="space-y-6 stagger-fade-in">
            {hasOpenFeedback ? (
              openFeedbackQuestions.map((question, index) => {
                const currentValue = responses[question.id] || '';
                const charCount = currentValue.trim().length;
                const charsRemaining = MAX_CHARS - currentValue.length;
                const isTooShort = charCount > 0 && charCount < MIN_CHARS;
                const isValid = charCount >= MIN_CHARS;
                
                return (
                  <div 
                    key={question.id} 
                    ref={el => questionRefs.current[index] = el}
                    className={`glass-card rounded-2xl p-6 space-y-4 transition-all duration-300 ${isValid ? 'ring-2 ring-ai-primary/30' : 'hover:shadow-ai-glow'}`}
                  >
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => scrollToQuestion(index)}
                        className={`flex-shrink-0 w-8 h-8 rounded-full text-white flex items-center justify-center font-semibold text-sm cursor-pointer hover:scale-110 transition-transform ${isValid ? 'bg-green-500' : 'bg-gradient-to-r from-ai-primary to-ai-accent'}`}
                      >
                        {isValid ? '✓' : index + 1}
                      </button>
                      <Label className="font-semibold pt-1 text-base">{question.text}</Label>
                    </div>
                    
                    <div className="pl-11 space-y-3">
                      <Textarea 
                        value={currentValue}
                        onChange={(e) => handleTextChange(question.id, e.target.value)}
                        placeholder="Type your answer here (10-50 characters)..."
                        className={`min-h-[80px] resize-none bg-background/50 border-border/50 focus:border-ai-primary transition-colors ${isTooShort ? 'border-amber-500' : ''}`}
                        maxLength={MAX_CHARS}
                      />
                      <div className="flex items-center justify-between">
                        <div className={`text-xs ${isTooShort ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {charCount < MIN_CHARS 
                            ? `${MIN_CHARS - charCount} more characters needed`
                            : `${charsRemaining} characters remaining`
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {charCount}/{MAX_CHARS}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="glass-card rounded-2xl p-6 text-muted-foreground text-sm">
                Open feedback is not configured for this study. You can finish now.
              </div>
            )}
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
                  : `Answer all questions (${answeredQuestionsCount}/${openFeedbackQuestions.length})`
              }
            </Button>
          </div>
        </div>
      </main>
      <ParticipantFooter />
    </div>
  );
};

export default PostTestPage3;
