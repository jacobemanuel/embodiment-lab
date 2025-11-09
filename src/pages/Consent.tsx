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
          <img src={logo} alt="Wiiniffrare" className="h-8" />
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
                This research examines how different presentation formats affect learning about German tax concepts for students. You will complete a brief pre-test, engage with four educational scenarios about taxes in Munich and Bavaria, and complete a post-test.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Procedures</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <span>1.</span>
                  <span>Complete demographic questions and a 10-question pre-test</span>
                </li>
                <li className="flex gap-2">
                  <span>2.</span>
                  <span>Participate in four interactive learning scenarios (~40 minutes)</span>
                </li>
                <li className="flex gap-2">
                  <span>3.</span>
                  <span>Rate your confidence and trust after each scenario</span>
                </li>
                <li className="flex gap-2">
                  <span>4.</span>
                  <span>Complete the same 10-question post-test</span>
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
                <strong className="text-foreground">Risks:</strong> Minimal. Some participants may experience mild fatigue during the 45-minute session.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Benefits:</strong> You will learn about important tax concepts relevant to students in Germany and contribute to research on educational technology.
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
