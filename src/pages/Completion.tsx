import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo-white.png";

const Completion = () => {
  const handleDownloadData = () => {
    const sessionData = sessionStorage.getItem('sessionData');
    const blob = new Blob([sessionData || ''], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <img src={logo} alt="Wiiniffrare" className="h-8" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10">
            <CheckCircle2 className="w-16 h-16 text-primary" />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold">Thank You!</h1>
            <p className="text-xl text-muted-foreground max-w-lg mx-auto">
              You've completed the AI literacy study. Your responses have been recorded and will help improve educational AI systems.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold">What You Learned</h2>
              <p className="text-muted-foreground leading-relaxed">
                You explored four critical topics in AI: bias in machine learning, transparency and interpretability, 
                LLM hallucinations and limitations, and societal impact. These concepts are fundamental to understanding 
                how AI systems work and their effects on society.
              </p>
            </div>

            <div className="bg-secondary/50 rounded-xl p-6 space-y-3">
              <h3 className="font-semibold">Your Data is Secure</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                All your responses have been anonymized and encrypted. No personally identifiable information 
                was collected. Your session ID is the only identifier, and it cannot be linked back to you.
              </p>
            </div>

            <div className="pt-4 space-y-3">
              <Button 
                size="lg"
                variant="outline"
                className="w-full"
                onClick={handleDownloadData}
              >
                Download My Responses (Optional)
              </Button>
              <p className="text-xs text-muted-foreground">
                You can download a copy of your anonymized responses for your records
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground">
              Questions about this study?
            </p>
            <p className="text-sm">
              Contact: <a href="mailto:study@wiiniffrare.com" className="text-primary hover:underline">study@wiiniffrare.com</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Completion;
