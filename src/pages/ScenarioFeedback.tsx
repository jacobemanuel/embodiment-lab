import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfidenceSlider } from "@/components/ConfidenceSlider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { scenarios } from "@/data/scenarios";
import logo from "@/assets/logo-white.png";

const ScenarioFeedback = () => {
  const { mode, scenarioId } = useParams();
  const navigate = useNavigate();
  
  const [confidenceRating, setConfidenceRating] = useState(5);
  const [trustRating, setTrustRating] = useState(5);
  const [wasEngaging, setWasEngaging] = useState(false);

  const scenario = scenarios.find(s => s.id === scenarioId);
  const scenarioIndex = scenarios.findIndex(s => s.id === scenarioId);
  const isLastScenario = scenarioIndex === scenarios.length - 1;

  const handleContinue = () => {
    // Save feedback
    const sessionData = JSON.parse(sessionStorage.getItem('sessionData') || '{}');
    const scenarios = sessionData.scenarios || [];
    const lastScenario = scenarios[scenarios.length - 1];
    
    if (lastScenario) {
      lastScenario.confidenceRating = confidenceRating;
      lastScenario.trustRating = trustRating;
      lastScenario.engagementRating = wasEngaging;
    }
    
    sessionStorage.setItem('sessionData', JSON.stringify(sessionData));

    // Navigate to next scenario or post-test
    if (isLastScenario) {
      navigate("/post-test");
    } else {
      const nextScenario = scenarios[scenarioIndex + 1];
      navigate(`/scenario/${mode}/${nextScenario.id}`);
    }
  };

  if (!scenario) {
    return <div>Scenario not found</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <img src={logo} alt="Wiiniffrare" className="h-8" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Scenario Complete!</h1>
            <p className="text-muted-foreground">
              You've finished learning about <strong>{scenario.title}</strong>. 
              Please share your thoughts below.
            </p>
          </div>

          <div className="space-y-8">
            {/* Confidence rating */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <ConfidenceSlider
                label={`How confident are you about understanding ${scenario.title.toLowerCase()}?`}
                onValueChange={setConfidenceRating}
                defaultValue={confidenceRating}
              />
            </div>

            {/* Trust rating */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <ConfidenceSlider
                label="Would you trust an AI system working in this domain?"
                onValueChange={setTrustRating}
                defaultValue={trustRating}
              />
            </div>

            {/* Engagement */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <Checkbox 
                  id="engaging"
                  checked={wasEngaging}
                  onCheckedChange={(checked) => setWasEngaging(checked === true)}
                />
                <Label 
                  htmlFor="engaging"
                  className="cursor-pointer flex-1 leading-relaxed"
                >
                  I found this scenario engaging and thought-provoking
                </Label>
              </div>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleContinue}
          >
            {isLastScenario ? "Continue to Post-Test" : "Continue to Next Scenario"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Scenario {scenarioIndex + 1} of {scenarios.length}
          </p>
        </div>
      </main>
    </div>
  );
};

export default ScenarioFeedback;
