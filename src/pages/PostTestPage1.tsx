import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import logo from "@/assets/logo-white.png";
import { useStudyQuestions } from "@/hooks/useStudyQuestions";
import { LikertScale } from "@/components/LikertScale";
import { Loader2 } from "lucide-react";
import { VerticalProgressBar } from "@/components/VerticalProgressBar";

const PostTestPage1 = () => {
  const navigate = useNavigate();
  const { questions: postTestQuestions, isLoading: questionsLoading, error } = useStudyQuestions('post_test');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  // Filter for likert questions with trust, engagement, satisfaction categories
  const likertQuestions = postTestQuestions.filter(q => 
    q.type === 'likert' && 
    ['trust', 'engagement', 'satisfaction'].includes(q.category || '')
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

  // Group questions by category
  const trustQuestions = postTestQuestions.filter(q => q.category === 'trust' && q.type === 'likert');
  const engagementQuestions = postTestQuestions.filter(q => q.category === 'engagement' && q.type === 'likert');
  const satisfactionQuestions = postTestQuestions.filter(q => q.category === 'satisfaction' && q.type === 'likert');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <img src={logo} alt="TUM Logo" className="h-8" />
          <div className="text-sm text-muted-foreground">
            Page 1 of 2 • {Object.keys(responses).length} of {likertQuestions.length} answered
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2 bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">
              Experience Assessment
            </h1>
            <p className="text-muted-foreground mb-6">
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
            {/* Trust Section */}
            {trustQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">Trust & Credibility</h2>
                {trustQuestions.map((question, idx) => (
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

            {/* Engagement Section */}
            {engagementQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-ai-primary to-ai-accent bg-clip-text text-transparent">Engagement</h2>
                {engagementQuestions.map((question, idx) => (
                  <div 
                    key={question.id} 
                    ref={el => questionRefs.current[trustQuestions.length + idx] = el}
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
                    ref={el => questionRefs.current[trustQuestions.length + engagementQuestions.length + idx] = el}
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
              className="w-full gradient-ai hover:shadow-ai-glow transition-all duration-300 hover:scale-[1.02]"
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
    </div>
  );
};

export default PostTestPage1;
