import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo-white.png";

const Welcome = () => {
  const navigate = useNavigate();

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
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-fade-in">
                  Tax Learning for Students
                </h1>
              </div>
              <p className="text-xl text-muted-foreground max-w-xl mx-auto">
                Master the German tax system as a student in Munich through interactive learning
              </p>
            </div>

            {/* Premium glass card */}
            <div className="glass-card rounded-3xl p-8 md:p-10 space-y-8 shadow-large hover:shadow-glow transition-all duration-500">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  Welcome!
                </h2>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  Thank you for participating in this tax education study. You'll explore an important topic about taxes in Germany through interactive conversation designed for students in Munich.
                </p>
              </div>

              {/* Features grid */}
              <div className="grid gap-4">
                <div className="flex gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors">
                  <span className="text-2xl">⏱️</span>
                  <div>
                    <strong className="text-foreground">~5 minutes</strong>
                    <p className="text-sm text-muted-foreground">Complete at your own pace</p>
                  </div>
                </div>
                
                <div className="flex gap-4 p-4 rounded-xl bg-accent/5 border border-accent/10 hover:bg-accent/10 transition-colors">
                  <span className="text-2xl">📚</span>
                  <div>
                    <strong className="text-foreground">1 Learning Scenario</strong>
                    <p className="text-sm text-muted-foreground">Interactive tax learning conversation</p>
                  </div>
                </div>
                
                <div className="flex gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <strong className="text-foreground">Interactive Format</strong>
                    <p className="text-sm text-muted-foreground">Pre-test, learning scenarios, and post-test</p>
                  </div>
                </div>
                
                <div className="flex gap-4 p-4 rounded-xl bg-accent/5 border border-accent/10 hover:bg-accent/10 transition-colors">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <strong className="text-foreground">Completely Anonymous</strong>
                    <p className="text-sm text-muted-foreground">Your privacy is our priority</p>
                  </div>
                </div>
              </div>

              {/* Privacy callout */}
              <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 border border-primary/20">
                <div className="relative z-10 space-y-3">
                  <h3 className="font-bold text-lg">Your privacy matters</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your responses help researchers design better tax education tools for students. No personally identifiable information is collected. Withdraw anytime without penalty.
                  </p>
                </div>
              </div>

              {/* CTA Button */}
              <div className="pt-2">
                <Button 
                  onClick={() => navigate("/consent")}
                  size="lg"
                  className="w-full text-lg h-16 rounded-2xl gradient-primary hover:shadow-glow transition-all duration-300 hover:scale-[1.02] font-semibold"
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
      </div>
    </div>
  );
};

export default Welcome;
