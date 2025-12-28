import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import logo from "@/assets/logo-white.png";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { LikertScale } from "@/components/LikertScale";
import { Loader2 } from "lucide-react";
import { VerticalProgressBar } from "@/components/VerticalProgressBar";
import ConsentSidebar from "@/components/ConsentSidebar";
import { useStudyFlowGuard } from "@/hooks/useStudyFlowGuard";
import { useBotDetection, logSuspiciousActivity } from "@/hooks/useBotDetection";
import ExitStudyButton from "@/components/ExitStudyButton";
import ParticipantFooter from "@/components/ParticipantFooter";
import { usePageTiming } from "@/hooks/usePageTiming";
import { updateQuestionSnapshot } from "@/lib/questionSnapshots";

const PostTestPage1 = () => {
  usePageTiming('post-test-1', 'Post-test Page 1');
  const navigate = useNavigate();
  
  // Guard: Ensure user completed learning phase
  useStudyFlowGuard('posttest1');
  
  // Bot detection
  const { recordQuestionStart, recordQuestionAnswer, analyzeTimingData } = useBotDetection({
    pageType: 'posttest',
    onSuspiciousActivity: async (result) => {
      const sessionId = sessionStorage.getItem('sessionId');
      if (sessionId) {
        await logSuspiciousActivity(sessionId, result, 'posttest1');
      }
    }
  });
  
  const { questions: postTestQuestions, isLoading: questionsLoading, error } = useStudyQuestions('post_test');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Get current study mode
  const studyMode = sessionStorage.getItem('studyMode') || 'text';

  const scrollToQuestion = (index: number) => {
    questionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Load existing responses from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('postTestPage1');
    if (saved) {
      setResponses(JSON.parse(saved));
    }
  }, []);

  // Save to sessionStorage whenever responses change
  useEffect(() => {
    if (Object.keys(responses).length > 0) {
      sessionStorage.setItem('postTestPage1', JSON.stringify(responses));
    }
  }, [responses]);

  // Filter questions based on mode_specific field and study mode
  // Also replace "avatar" with "AI chatbot" for text mode users
  const filteredQuestions = postTestQuestions
    .filter(q => {
      const modeSpecific = q.modeSpecific || 'both';
      return modeSpecific === 'both' || modeSpecific === studyMode;
    })
    .map(q => {
      // For text mode, replace avatar-related text with AI chatbot
      if (studyMode === 'text') {
        return {
          ...q,
          text: q.text
            .replace(/\bavatar\b/gi, 'AI chatbot')
            .replace(/\bthe avatar\b/gi, 'the AI chatbot')
            .replace(/\bthis avatar\b/gi, 'this AI chatbot')
        };
      }
      return q;
    });

  useEffect(() => {
    if (likertQuestions.length === 0) return;
    const snapshot = likertQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      category: q.category,
      type: q.type,
      options: q.options,
    }));
    updateQuestionSnapshot('postTestQuestionsSnapshot', snapshot);
  }, [likertQuestions]);

  // Filter for likert questions with all perception-related categories (exclude knowledge and open_feedback)
  const likertQuestions = filteredQuestions.filter(q => 
    q.type === 'likert' && 
    ['trust', 'engagement', 'satisfaction', 'expectations', 'avatar-qualities', 'realism'].includes(q.category || '')
  );
  
  const allQuestionsAnswered = likertQuestions.length > 0 && likertQuestions.every(q => responses[q.id]);
  const progress = likertQuestions.length > 0 ? Object.keys(responses).length / likertQuestions.length * 100 : 0;

  const handleNext = () => {
    if (allQuestionsAnswered) {
      sessionStorage.setItem('postTestPage1', JSON.stringify(responses));
      navigate('/post-test-2');
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

  // Group questions by category from filtered questions
  const expectationsQuestions = filteredQuestions.filter(q => q.category === 'expectations' && q.type === 'likert');
  const avatarQualitiesQuestions = filteredQuestions.filter(q => q.category === 'avatar-qualities' && q.type === 'likert');
  const realismQuestions = filteredQuestions.filter(q => q.category === 'realism' && q.type === 'likert');
  const trustQuestions = filteredQuestions.filter(q => q.category === 'trust' && q.type === 'likert');
  const engagementQuestions = filteredQuestions.filter(q => q.category === 'engagement' && q.type === 'likert');
  const satisfactionQuestions = filteredQuestions.filter(q => q.category === 'satisfaction' && q.type === 'likert');
  
  // Update section header for text mode
  const avatarSectionTitle = studyMode === 'text' ? 'AI Chatbot Experience' : 'Avatar Experience';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ConsentSidebar />
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <img src={logo} alt="TUM Logo" className="h-8" />
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Page 1 of 3 • {Object.keys(responses).length} of {likertQuestions.length} answered
            </div>
            <ExitStudyButton />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2 bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">
              Experience Assessment
            </h1>
            <p className="text-muted-foreground mb-6 text-justify">
              Please rate your experience with the learning system.
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
            totalQuestions={likertQuestions.length}
            answeredQuestions={Object.keys(responses).length}
            questionIds={likertQuestions.map(q => q.id)}
            responses={responses}
            onQuestionClick={scrollToQuestion}
          />

          <div className="space-y-8 stagger-fade-in">
            {/* Expectations Section */}
            {expectationsQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">Expectations</h2>
                {expectationsQuestions.map((question, idx) => (
                  <div 
                    key={question.id} 
                    ref={el => questionRefs.current[idx] = el}
                    className="glass-card rounded-2xl p-6 space-y-5 hover:shadow-ai-glow transition-all duration-300"
                  >
                    <h3 className="font-medium text-lg">{question.text}</h3>
                    <LikertScale
                      id={question.id}
                      value={responses[question.id] || ""}
                      onChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Avatar Qualities Section */}
            {avatarQualitiesQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">{avatarSectionTitle}</h2>
                {avatarQualitiesQuestions.map((question, idx) => (
                  <div 
                    key={question.id} 
                    ref={el => questionRefs.current[expectationsQuestions.length + idx] = el}
                    className="glass-card rounded-2xl p-6 space-y-5 hover:shadow-ai-glow transition-all duration-300"
                  >
                    <h3 className="font-medium text-lg">{question.text}</h3>
                    <LikertScale
                      id={question.id}
                      value={responses[question.id] || ""}
                      onChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Realism Section */}
            {realismQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">Realism & Naturalness</h2>
                {realismQuestions.map((question, idx) => (
                  <div 
                    key={question.id} 
                    ref={el => questionRefs.current[expectationsQuestions.length + avatarQualitiesQuestions.length + idx] = el}
                    className="glass-card rounded-2xl p-6 space-y-5 hover:shadow-ai-glow transition-all duration-300"
                  >
                    <h3 className="font-medium text-lg">{question.text}</h3>
                    <LikertScale
                      id={question.id}
                      value={responses[question.id] || ""}
                      onChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Trust Section */}
            {trustQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">Trust & Credibility</h2>
                {trustQuestions.map((question, idx) => (
                  <div 
                    key={question.id} 
                    ref={el => questionRefs.current[expectationsQuestions.length + avatarQualitiesQuestions.length + realismQuestions.length + idx] = el}
                    className="glass-card rounded-2xl p-6 space-y-5 hover:shadow-ai-glow transition-all duration-300"
                  >
                    <h3 className="font-medium text-lg">{question.text}</h3>
                    <LikertScale
                      id={question.id}
                      value={responses[question.id] || ""}
                      onChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Engagement Section */}
            {engagementQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">Engagement</h2>
                {engagementQuestions.map((question, idx) => (
                  <div 
                    key={question.id} 
                    ref={el => questionRefs.current[expectationsQuestions.length + avatarQualitiesQuestions.length + realismQuestions.length + trustQuestions.length + idx] = el}
                    className="glass-card rounded-2xl p-6 space-y-5 hover:shadow-ai-glow transition-all duration-300"
                  >
                    <h3 className="font-medium text-lg">{question.text}</h3>
                    <LikertScale
                      id={question.id}
                      value={responses[question.id] || ""}
                      onChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Satisfaction Section */}
            {satisfactionQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">Overall Satisfaction</h2>
                {satisfactionQuestions.map((question, idx) => (
                  <div 
                    key={question.id} 
                    ref={el => questionRefs.current[expectationsQuestions.length + avatarQualitiesQuestions.length + realismQuestions.length + trustQuestions.length + engagementQuestions.length + idx] = el}
                    className="glass-card rounded-2xl p-6 space-y-5 hover:shadow-ai-glow transition-all duration-300"
                  >
                    <h3 className="font-medium text-lg">{question.text}</h3>
                    <LikertScale
                      id={question.id}
                      value={responses[question.id] || ""}
                      onChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sticky bottom-6 glass-card rounded-2xl p-4 shadow-medium">
            <Button
              size="lg"
              className={`w-full transition-all duration-300 ${allQuestionsAnswered ? 'gradient-ai hover:shadow-ai-glow hover:scale-[1.02]' : 'bg-muted text-muted-foreground'}`}
              onClick={handleNext}
              disabled={!allQuestionsAnswered}
            >
              {allQuestionsAnswered 
                ? "Continue to Knowledge Test →" 
                : `Answer all questions to continue (${Object.keys(responses).length}/${likertQuestions.length})`
              }
            </Button>
          </div>
        </div>
      </main>
      <ParticipantFooter />
    </div>
  );
};

export default PostTestPage1;
