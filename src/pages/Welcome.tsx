import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Clock, Sparkles, MousePointerClick, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo-white.png";
import { useEffect, useState } from "react";
import ParticipantFooter from "@/components/ParticipantFooter";
import { clearTelemetrySavedFlag, clearTimingLog } from "@/lib/sessionTelemetry";
import { usePageTiming } from "@/hooks/usePageTiming";

const Welcome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [studyLocked, setStudyLocked] = useState(false);

  usePageTiming('welcome', 'Welcome');

  const resetStudyState = () => {
    sessionStorage.removeItem('sessionId');
    sessionStorage.removeItem('studyMode');
    sessionStorage.removeItem('demographics');
    sessionStorage.removeItem('preTest');
    sessionStorage.removeItem('postTestPage1');
    sessionStorage.removeItem('postTestPage2');
    sessionStorage.removeItem('postTestPage3');
    sessionStorage.removeItem('postTest1');
    sessionStorage.removeItem('currentSlide');
    sessionStorage.removeItem('preAssignedMode');
    sessionStorage.removeItem('studyCompleted');
    sessionStorage.removeItem('demographicQuestionsSnapshot');
    sessionStorage.removeItem('preTestQuestionsSnapshot');
    sessionStorage.removeItem('postTestQuestionsSnapshot');
    sessionStorage.removeItem('dialogueLog');
    sessionStorage.removeItem('tutorDialogueLog');
    sessionStorage.removeItem('tutorDialogueSaved');
    sessionStorage.removeItem('scenarioFeedback');
    clearTimingLog();
    clearTelemetrySavedFlag();
    localStorage.removeItem('studyCompleted');
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('reset') === '1') {
      resetStudyState();
      setStudyLocked(false);
      navigate('/', { replace: true });
      return;
    }
    setStudyLocked(localStorage.getItem('studyCompleted') === 'true');
  }, [location.search, navigate]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Modern gradient mesh background */}
      <div className="fixed inset-0 gradient-mesh opacity-60" />
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background/95 to-background/90" />
      
      {/* Floating elements */}
      <div className="fixed top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Glassmorphic Header */}
        <header className="glass-card border-b">
          <div className="container mx-auto px-6 py-4">
            <img src={logo} alt="TUM Logo" className="h-8" />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-8 animate-fade-in">
            {/* Hero section with gradient text */}
            <div className="text-center space-y-6">
              <div className="inline-block">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-relaxed bg-gradient-to-r from-ai-primary via-ai-accent to-ai-secondary bg-clip-text text-transparent animate-fade-in px-4 py-2">
                  AI Image Generation Study
                </h1>
              </div>
            </div>

            {/* Premium glass card */}
            <div className="glass-card rounded-3xl p-8 md:p-10 space-y-8 shadow-large hover:shadow-ai-glow transition-all duration-500">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  Welcome!
                </h2>
                <p className="text-muted-foreground leading-relaxed text-lg text-justify">
                  Thank you for participating in this study on AI-powered learning. You'll explore AI image generation through an interactive experience designed to investigate how embodied AI agents can enhance trust, engagement, and comprehension in education.
                </p>
              </div>

              {/* Features grid */}
              <div className="grid gap-4">
                <div 
                  className="flex gap-4 p-4 rounded-xl bg-ai-primary/5 border border-ai-primary/10 hover:bg-ai-primary/10 transition-all hover:scale-[1.02] opacity-0 animate-fade-in"
                  style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-ai-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-ai-primary" />
                  </div>
                  <div>
                    <strong className="text-foreground">~15 minutes</strong>
                    <p className="text-sm text-muted-foreground">Complete at your own pace</p>
                  </div>
                </div>
                
                <div 
                  className="flex gap-4 p-4 rounded-xl bg-ai-accent/5 border border-ai-accent/10 hover:bg-ai-accent/10 transition-all hover:scale-[1.02] opacity-0 animate-fade-in"
                  style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-ai-accent/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-ai-accent" />
                  </div>
                  <div>
                    <strong className="text-foreground">AI Image Playground</strong>
                    <p className="text-sm text-muted-foreground">Generate images while you learn</p>
                  </div>
                </div>
                
                <div 
                  className="flex gap-4 p-4 rounded-xl bg-ai-primary/5 border border-ai-primary/10 hover:bg-ai-primary/10 transition-all hover:scale-[1.02] opacity-0 animate-fade-in"
                  style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-ai-primary/10 flex items-center justify-center shrink-0">
                    <MousePointerClick className="w-5 h-5 text-ai-primary" />
                  </div>
                  <div>
                    <strong className="text-foreground">Interactive Format</strong>
                    <p className="text-sm text-muted-foreground">Pre-test, learning slides, and post-test</p>
                  </div>
                </div>
                
                <div 
                  className="flex gap-4 p-4 rounded-xl bg-ai-accent/5 border border-ai-accent/10 hover:bg-ai-accent/10 transition-all hover:scale-[1.02] opacity-0 animate-fade-in"
                  style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-ai-accent/10 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-ai-accent" />
                  </div>
                  <div>
                    <strong className="text-foreground">Completely Anonymous</strong>
                    <p className="text-sm text-muted-foreground">Your privacy is our priority</p>
                  </div>
                </div>
              </div>

              {/* Privacy callout */}
              <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-ai-primary/10 via-ai-accent/5 to-ai-secondary/10 border border-ai-primary/20">
                <div className="relative z-10 space-y-3">
                  <h3 className="font-bold text-lg">Your privacy matters</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your responses help researchers design better AI-powered educational tools. No personally identifiable information is collected. Withdraw anytime without penalty.
                  </p>
                </div>
              </div>

              {/* Lock Notice */}
              {studyLocked && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
                  This device already completed the study. To protect data quality, repeat participation is blocked.
                </div>
              )}

              {/* CTA Button */}
              <div className="pt-2">
              <Button 
                onClick={() => {
                  // Start a completely fresh study session
                  resetStudyState();
                  navigate("/consent");
                }}
                size="lg"
                disabled={studyLocked}
                className="w-full text-lg h-16 rounded-2xl gradient-ai hover:shadow-ai-glow transition-all duration-300 hover:scale-[1.02] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Continue to Consent Form →
              </Button>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Questions? <a href="mailto:contact@majewski.studio" className="text-primary hover:text-accent transition-colors font-medium">contact@majewski.studio</a>
            </p>
          </div>
        </main>
        <ParticipantFooter />
      </div>
    </div>
  );
};

export default Welcome;
