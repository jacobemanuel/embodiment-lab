import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { FileText, List, Database, Scale, Hand, Loader2 } from "lucide-react";
import logo from "@/assets/logo-white.png";
import { createStudySession } from "@/lib/studyData";
import { toast } from "sonner";
import ExitStudyButton from "@/components/ExitStudyButton";

const Consent = () => {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (agreed) {
      setIsLoading(true);
      try {
        // Create session when user consents (before navigating to demographics)
        const sessionId = await createStudySession('text'); // Default mode, will be updated later
        sessionStorage.setItem('sessionId', sessionId);
        navigate("/demographics");
      } catch (error) {
        console.error('Error creating session:', error);
        toast.error('Failed to start study session. Please try again.');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <img src={logo} alt="TUM Logo" className="h-8" />
          <ExitStudyButton />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-3xl">
        <div className="space-y-8 animate-fade-in">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">Informed Consent</h1>
            <p className="text-muted-foreground">Please read carefully before participating</p>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-8 space-y-8">
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Purpose of the Study</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-11 text-justify">
                This research investigates how embodied AI agents, such as virtual avatars powered by large language models, can enhance learners' trust, engagement, and comprehension in AI literacy education. You will learn about AI image generation as a practical example of AI capabilities, comparing text-based and avatar-based learning formats. Results will inform the design of trustworthy, engaging AI companions for education.
              </p>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <List className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Procedures</h2>
              </div>
              <ul className="space-y-2 text-muted-foreground pl-11">
                <li className="flex gap-3">
                  <span className="text-primary font-medium">1.</span>
                  <span>Complete demographic questions and a brief pre-test about AI image generation</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-medium">2.</span>
                  <span>Learn AI image generation basics through interactive slides (~10 minutes)</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-medium">3.</span>
                  <span>Practice with the AI Image Playground to generate your own images</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-medium">4.</span>
                  <span>Complete a post-test evaluating trust, engagement, satisfaction, and knowledge</span>
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Database className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Data Collection & Privacy</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-11 text-justify">
                We will collect your responses, confidence ratings, and dialogue interactions. All data is:
              </p>
              <ul className="space-y-1.5 text-muted-foreground pl-11 ml-4">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  Completely anonymous (no names or emails linked to responses)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  Assigned a random session ID only
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  Stored securely and encrypted
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  Used solely for research purposes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  Compliant with GDPR and privacy regulations
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-2 shrink-0" />
                  <span><strong>No video recording</strong> — if you participate in Avatar Mode, your camera feed is used only for real-time interaction to enhance the experience. No video data is stored or saved.</span>
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Scale className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Risks & Benefits</h2>
              </div>
              <div className="pl-11 space-y-2">
                <p className="text-muted-foreground leading-relaxed text-justify">
                  <strong className="text-foreground">Risks:</strong> Minimal. Some participants may experience mild fatigue during the approximately 10-minute session.
                </p>
                <p className="text-muted-foreground leading-relaxed text-justify">
                  <strong className="text-foreground">Benefits:</strong> You will learn fundamental concepts of AI image generation, including prompt engineering and creative techniques. Your participation contributes to research on trustworthy AI-powered educational systems and helps inform the design of engaging AI learning companions.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Hand className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Voluntary Participation</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed pl-11 text-justify">
                Your participation is completely voluntary. You may withdraw at any time without penalty by simply closing your browser. Partial data will not be used.
              </p>
            </section>

            <div className="pt-6 border-t border-border">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <Checkbox 
                  id="consent" 
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                  className="mt-0.5"
                />
                <label 
                  htmlFor="consent"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I confirm that I am 18 years of age or older. I have read and understood the information above. I voluntarily agree to participate in this research study. I understand my responses will be anonymous and I can withdraw at any time.
                </label>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => navigate("/")}
              >
                Decline
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={handleContinue}
                disabled={!agreed || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "I Consent - Continue"
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Consent;
