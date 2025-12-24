import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import logo from "@/assets/logo-white.png";
import { saveDemographics } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { StudyMode } from "@/types/study";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { Loader2 } from "lucide-react";
import { VerticalProgressBar } from "@/components/VerticalProgressBar";
import ConsentSidebar from "@/components/ConsentSidebar";
import { useStudyFlowGuard } from "@/hooks/useStudyFlowGuard";
import { useBotDetection, logSuspiciousActivity } from "@/hooks/useBotDetection";
import ExitStudyButton from "@/components/ExitStudyButton";

const Demographics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Guard: Ensure user has a valid session (from consent)
  useStudyFlowGuard('demographics');
  
  // Bot detection
  const { recordQuestionStart, recordQuestionAnswer, analyzeTimingData } = useBotDetection({
    pageType: 'demographics',
    onSuspiciousActivity: async (result) => {
      const sessionId = sessionStorage.getItem('sessionId');
      if (sessionId) {
        await logSuspiciousActivity(sessionId, result, 'demographics');
      }
    }
  });
  
  const { questions: demographicQuestions, isLoading: questionsLoading, error } = useStudyQuestions('demographic');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [otherTextInputs, setOtherTextInputs] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isUnderAge, setIsUnderAge] = useState(false);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Track when questions are viewed - use ref to avoid recreation on each render
  useEffect(() => {
    if (demographicQuestions.length > 0) {
      demographicQuestions.forEach(q => {
        recordQuestionStart(q.id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demographicQuestions.length]);

  const scrollToQuestion = (index: number) => {
    questionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Helpers used in render/validation
  // NOTE: these must be declared BEFORE they are referenced to avoid TDZ ReferenceErrors
  const needsOtherTextInput = (questionId: string, questionText: string) => {
    const t = questionText.toLowerCase();
    return t.includes('language') || t.includes('język') || questionId.toLowerCase().includes('language');
  };

  const needsYesFollowUp = (questionId: string, questionText: string) => {
    const t = questionText.toLowerCase();
    return t.includes('accessibility') || t.includes('dostęp') || questionId.toLowerCase().includes('accessibility');
  };

  const isQuestionComplete = (questionId: string, questionText: string) => {
    const answer = responses[questionId];
    if (!answer || answer.trim() === "") return false;

    // If answer is "Other" or starts with "Other", check if we have additional text input
    if (answer.toLowerCase().startsWith('other') && needsOtherTextInput(questionId, questionText)) {
      const otherText = otherTextInputs[questionId];
      return !!otherText && otherText.trim() !== "";
    }

    // If answer is "Yes" and question needs follow-up, check for additional text
    if (answer.toLowerCase() === 'yes' && needsYesFollowUp(questionId, questionText)) {
      const followUpText = otherTextInputs[questionId];
      return !!followUpText && followUpText.trim() !== "";
    }

    return true;
  };

  const completedQuestionsCount =
    demographicQuestions.length > 0
      ? demographicQuestions.filter((q) => isQuestionComplete(q.id, q.text)).length
      : 0;

  // Check if all questions are answered
  const allQuestionsAnswered =
    demographicQuestions.length > 0 && completedQuestionsCount === demographicQuestions.length;

  const handleContinue = async () => {
    if (allQuestionsAnswered) {
      setIsLoading(true);
      
      // Analyze timing data for bot detection before proceeding
      const botResult = analyzeTimingData();
      
      try {
        const sessionId = sessionStorage.getItem('sessionId');
        
        if (!sessionId) {
          throw new Error('No session ID found');
        }
        
        // Report suspicious activity if detected
        if (botResult.suspicionLevel !== 'none' && sessionId) {
          await logSuspiciousActivity(sessionId, botResult, 'demographics');
        }
        
        // Send responses using question IDs as keys
        // For "Other" or "Yes" answers with follow-up, combine with the text input
        const finalResponses: Record<string, string> = {};
        for (const [qId, answer] of Object.entries(responses)) {
          const question = demographicQuestions.find(q => q.id === qId);
          if (answer.toLowerCase().startsWith('other') && otherTextInputs[qId]) {
            finalResponses[qId] = `Other: ${otherTextInputs[qId]}`;
          } else if (answer.toLowerCase() === 'yes' && question && needsYesFollowUp(question.id, question.text) && otherTextInputs[qId]) {
            finalResponses[qId] = `Yes: ${otherTextInputs[qId]}`;
          } else {
            finalResponses[qId] = answer;
          }
        }
        
        await saveDemographics(sessionId, finalResponses);
        sessionStorage.setItem('demographics', JSON.stringify(finalResponses));
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

  // Check if a question should use text input (for age question only)
  // IMPORTANT: avoid matching words like "generation" (contains "age")
  const isAgeQuestion = (questionId: string, questionText: string) => {
    if (questionId === 'demo-age') return true;
    const t = questionText.toLowerCase();
    const hasAgeWord = /\bage\b/.test(t) || /\bwiek\b/.test(t);
    const isGenerationContext = t.includes('generation');
    return hasAgeWord && !isGenerationContext;
  };

  // Handle age input change (just update value, no validation yet)
  const handleAgeChange = (questionId: string, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  // Validate age on blur (when user leaves the field)
  const handleAgeBlur = (value: string) => {
    const age = parseInt(value, 10);
    if (!isNaN(age) && age < 18 && age > 0) {
      setIsUnderAge(true);
    }
  };

  // Under-age screen
  if (isUnderAge) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <img src={logo} alt="Majewski Studio" className="h-8" />
          </div>
        </header>

        <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl flex items-center justify-center">
          <div className="glass-card rounded-2xl p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-ai-primary to-ai-accent flex items-center justify-center">
              <span className="text-3xl">🙏</span>
            </div>
            <h1 className="text-2xl font-semibold">Thank You for Your Interest!</h1>
            <p className="text-muted-foreground leading-relaxed">
              We appreciate your willingness to participate in our study. Unfortunately, participants must be <strong>18 years or older</strong> to take part in this research.
            </p>
            <p className="text-muted-foreground">
              Thank you for your understanding, and we wish you all the best!
            </p>
            <Button 
              onClick={() => navigate('/')}
              className="gradient-ai hover:shadow-ai-glow"
            >
              Return to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

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
      <ConsentSidebar />
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <img src={logo} alt="Majewski Studio" className="h-8" />
          <ExitStudyButton />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2 bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">
              Background Information
            </h1>
            <p className="text-muted-foreground mb-6">Help us understand your background</p>
            
            {/* Progress bar */}
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-ai-primary to-ai-accent transition-all duration-300"
                style={{ width: `${demographicQuestions.length > 0 ? (completedQuestionsCount / demographicQuestions.length * 100) : 0}%` }}
              />
            </div>
          </div>

          <VerticalProgressBar
            totalQuestions={demographicQuestions.length}
            answeredQuestions={completedQuestionsCount}
            questionIds={demographicQuestions.map(q => q.id)}
            responses={responses}
            isQuestionComplete={(questionId) => {
              const question = demographicQuestions.find(q => q.id === questionId);
              return question ? isQuestionComplete(question.id, question.text) : false;
            }}
            onQuestionClick={scrollToQuestion}
          />

          <div className="space-y-6 stagger-fade-in">
            {demographicQuestions.map((question, index) => (
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
                
                {/* Text input for age question, radio for others */}
                {isAgeQuestion(question.id, question.text) ? (
                  <div className="pl-11 space-y-3">
                    <Input
                      type="number"
                      placeholder={question.placeholder || "Enter your age"}
                      value={responses[question.id] || ""}
                      onChange={(e) => handleAgeChange(question.id, e.target.value)}
                      onBlur={(e) => handleAgeBlur(e.target.value)}
                      className="max-w-xs"
                      min="1"
                      max="150"
                    />

                    {(question.preferNotToSay ?? true) && (
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={`prefer-not-${question.id}`}
                          checked={responses[question.id] === "Prefer not to say"}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setResponses((prev) => ({ ...prev, [question.id]: "Prefer not to say" }));
                              setIsUnderAge(false);
                            } else {
                              setResponses((prev) => ({ ...prev, [question.id]: "" }));
                            }
                          }}
                        />
                        <Label htmlFor={`prefer-not-${question.id}`} className="cursor-pointer">
                          Prefer not to say
                        </Label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pl-11 space-y-3">
                    <RadioGroup
                      value={responses[question.id] || ""}
                      onValueChange={(value) => {
                        setResponses((prev) => ({ ...prev, [question.id]: value }));
                        // Clear text input if not selecting "Other" or "Yes" (for follow-up questions)
                        const needsClear = !value.toLowerCase().startsWith('other') && value.toLowerCase() !== 'yes';
                        if (needsClear) {
                          setOtherTextInputs((prev) => {
                            const next = { ...prev };
                            delete next[question.id];
                            return next;
                          });
                        }
                      }}
                    >
                      <div className="space-y-3">
                        {question.options.map((option) => (
                          <div key={option} className="flex items-center space-x-3 group">
                            <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                            <Label
                              htmlFor={`${question.id}-${option}`}
                              className="cursor-pointer flex-1 leading-relaxed group-hover:text-foreground transition-colors"
                            >
                              {option}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                    
                    {/* Show text input when "Other" is selected for language questions */}
                    {responses[question.id]?.toLowerCase().startsWith('other') && needsOtherTextInput(question.id, question.text) && (
                      <div className="mt-3 animate-fade-in">
                        <Input
                          type="text"
                          placeholder="Please specify (max 50 characters)"
                          value={otherTextInputs[question.id] || ""}
                          onChange={(e) => {
                            const value = e.target.value.slice(0, 50);
                            setOtherTextInputs((prev) => ({ ...prev, [question.id]: value }));
                          }}
                          maxLength={50}
                          className={`max-w-xs ${
                            !otherTextInputs[question.id]?.trim() ? "border-destructive" : ""
                          }`}
                        />
                        <p className={`text-xs mt-1 ${
                          !otherTextInputs[question.id]?.trim() ? "text-destructive" : "text-muted-foreground"
                        }`}>
                          {otherTextInputs[question.id]?.length || 0}/50 characters
                        </p>
                        {!otherTextInputs[question.id]?.trim() && (
                          <p className="text-xs text-destructive mt-1">Please specify to continue.</p>
                        )}
                      </div>
                    )}
                    
                    {/* Show text input when "Yes" is selected for accessibility questions */}
                    {responses[question.id]?.toLowerCase() === 'yes' && needsYesFollowUp(question.id, question.text) && (
                      <div className="mt-3 animate-fade-in">
                        <Input
                          type="text"
                          placeholder="Please describe your accessibility needs (max 50 characters)"
                          value={otherTextInputs[question.id] || ""}
                          onChange={(e) => {
                            const value = e.target.value.slice(0, 50);
                            setOtherTextInputs((prev) => ({ ...prev, [question.id]: value }));
                          }}
                          maxLength={50}
                          className={`max-w-xs ${
                            !otherTextInputs[question.id]?.trim() ? "border-destructive" : ""
                          }`}
                        />
                        <p className={`text-xs mt-1 ${
                          !otherTextInputs[question.id]?.trim() ? "text-destructive" : "text-muted-foreground"
                        }`}>
                          {otherTextInputs[question.id]?.length || 0}/50 characters
                        </p>
                        {!otherTextInputs[question.id]?.trim() && (
                          <p className="text-xs text-destructive mt-1">Please add details to continue.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
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
                  ? "Continue to Pre-Test" 
                  : `Answer all questions to continue (${completedQuestionsCount}/${demographicQuestions.length})`
              }
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Demographics;
