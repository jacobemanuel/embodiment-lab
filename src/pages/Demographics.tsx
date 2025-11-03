import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "@/assets/logo-white.png";
import { demographicQuestions } from "@/data/questions";

const Demographics = () => {
  const navigate = useNavigate();
  const [responses, setResponses] = useState<Record<string, string>>({});

  const allQuestionsAnswered = demographicQuestions.every(q => responses[q.id]);

  const handleContinue = () => {
    if (allQuestionsAnswered) {
      // Store demographics in sessionStorage for later
      sessionStorage.setItem('demographics', JSON.stringify(responses));
      navigate("/pre-test");
    }
  };

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
            <h1 className="text-3xl font-semibold mb-2">Background Information</h1>
            <p className="text-muted-foreground">Help us understand your background (optional)</p>
          </div>

          <div className="space-y-8">
            {demographicQuestions.map((question) => (
              <div key={question.id} className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold">{question.text}</h3>
                <RadioGroup
                  value={responses[question.id] || ""}
                  onValueChange={(value) => setResponses(prev => ({ ...prev, [question.id]: value }))}
                >
                  <div className="space-y-3">
                    {question.options.map((option) => (
                      <div key={option} className="flex items-center space-x-3">
                        <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                        <Label 
                          htmlFor={`${question.id}-${option}`}
                          className="cursor-pointer flex-1 py-2"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleContinue}
            disabled={!allQuestionsAnswered}
          >
            Continue to Pre-Test
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Demographics;
