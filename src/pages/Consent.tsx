import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "@/assets/logo-white.png";

const Consent = () => {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const handleContinue = () => {
    if (agreed) {
      navigate("/demographics");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <img src={logo} alt="TUM Logo" className="h-8" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-3xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Informed Consent</h1>
            <p className="text-muted-foreground">Please read carefully before participating</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Purpose of the Study</h2>
              <p className="text-muted-foreground leading-relaxed">
                This research examines how different presentation formats (text-based vs. avatar-based) affect learning about AI image generation fundamentals. You will complete a brief pre-test, learn through interactive slides about AI-powered image creation, practice with a real-time image playground, and complete a post-test assessment.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Procedures</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <span>1.</span>
                  <span>Complete demographic questions and a brief pre-test about AI image generation</span>
                </li>
                <li className="flex gap-2">
                  <span>2.</span>
                  <span>Learn AI image generation basics through interactive slides (~10 minutes)</span>
                </li>
                <li className="flex gap-2">
                  <span>3.</span>
                  <span>Practice with the AI Image Playground to generate your own images</span>
                </li>
                <li className="flex gap-2">
                  <span>4.</span>
                  <span>Complete a post-test evaluating trust, engagement, satisfaction, and knowledge</span>
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Data Collection & Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We will collect your responses, confidence ratings, and dialogue interactions. All data is:
              </p>
              <ul className="space-y-2 text-muted-foreground ml-4">
                <li>• Completely anonymous (no names or emails linked to responses)</li>
                <li>• Assigned a random session ID only</li>
                <li>• Stored securely and encrypted</li>
                <li>• Used solely for research purposes</li>
                <li>• Compliant with GDPR and privacy regulations</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Risks & Benefits</h2>
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Risks:</strong> Minimal. Some participants may experience mild fatigue during the approximately 10-minute session.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Benefits:</strong> You will learn fundamental concepts of AI image generation, including prompt engineering, style control, and creative techniques. You'll contribute to research on AI-powered educational systems.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Voluntary Participation</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your participation is completely voluntary. You may withdraw at any time without penalty by simply closing your browser. Partial data will not be used.
              </p>
            </section>

            <div className="pt-6 border-t border-border">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="consent" 
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                />
                <label 
                  htmlFor="consent"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I have read and understood the information above. I voluntarily agree to participate in this research study. I understand my responses will be anonymous and I can withdraw at any time.
                </label>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
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
                disabled={!agreed}
              >
                I Consent - Continue
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Consent;
