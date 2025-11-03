import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo-white.png";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <img src={logo} alt="Wiiniffrare" className="h-8" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight">
              AI Literacy Study
            </h1>
            <p className="text-xl text-muted-foreground">
              Help us understand how people learn about AI
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 space-y-6 shadow-subtle">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Welcome!</h2>
              <p className="text-muted-foreground leading-relaxed">
                Thank you for participating in this research study. You'll explore four important topics about artificial intelligence through interactive conversations.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">What to expect:</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span><strong className="text-foreground">Duration:</strong> Approximately 40-45 minutes</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span><strong className="text-foreground">Topics:</strong> AI bias, transparency, limitations, and societal impact</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span><strong className="text-foreground">Format:</strong> Pre-test, 4 learning scenarios, post-test</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span><strong className="text-foreground">Privacy:</strong> All responses are completely anonymous</span>
                </li>
              </ul>
            </div>

            <div className="bg-secondary/50 rounded-xl p-6 space-y-3">
              <h3 className="font-semibold">Your privacy matters</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your responses will help researchers understand how to design better AI educational tools. No personally identifiable information will be collected or stored. You can withdraw at any time without penalty.
              </p>
            </div>

            <div className="pt-4">
              <Button 
                onClick={() => navigate("/consent")}
                size="lg"
                className="w-full text-lg h-14 rounded-xl"
              >
                Continue to Consent Form
              </Button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Questions? Contact the research team at <a href="mailto:study@wiiniffrare.com" className="text-primary hover:underline">study@wiiniffrare.com</a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Welcome;
