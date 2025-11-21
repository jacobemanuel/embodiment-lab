import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import logo from "@/assets/logo-white.png";
import { postTestQuestions } from "@/data/postTestQuestions";
import { LikertScale } from "@/components/LikertScale";

const PostTestPage1 = () => {
  const navigate = useNavigate();
  const [responses, setResponses] = useState<Record<string, string>>({});

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

  const likertQuestions = postTestQuestions.filter(q => 
    q.type === 'likert' && 
    ['trust', 'engagement', 'satisfaction'].includes(q.category || '')
  );
  
  const allQuestionsAnswered = likertQuestions.every(q => responses[q.id]);
  const progress = Object.keys(responses).length / likertQuestions.length * 100;

  const handleNext = () => {
    if (allQuestionsAnswered) {
      sessionStorage.setItem('postTest1', JSON.stringify(responses));
      navigate('/post-test-2');
    }
  };

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

      <main className="flex-1 container mx-auto px-6 py-12 max-w-3xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Experience Assessment</h1>
            <p className="text-muted-foreground mb-6">
              Please rate your experience with the learning system.
            </p>
            
            {/* Progress bar */}
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-8">
            {/* Trust Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-primary">Trust & Credibility</h2>
              {postTestQuestions.filter(q => q.category === 'trust' && q.type === 'likert').map((question) => (
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
          </div>

          <div className="sticky bottom-6 bg-background/95 backdrop-blur-sm border border-border rounded-2xl p-4 shadow-medium">
            <Button
              size="lg"
              className="w-full"
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
