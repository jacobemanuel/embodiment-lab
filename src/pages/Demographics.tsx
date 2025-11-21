import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "@/assets/logo-white.png";
import { saveDemographics } from "@/lib/studyData";
import { useToast } from "@/hooks/use-toast";
import { StudyMode } from "@/types/study";

const Demographics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [age, setAge] = useState<string>("");
  const [preferNotToSayAge, setPreferNotToSayAge] = useState(false);
  const [education, setEducation] = useState<string>("");
  const [digitalExperience, setDigitalExperience] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const allQuestionsAnswered = 
    (age.trim() !== "" || preferNotToSayAge) && 
    education !== "" && 
    digitalExperience !== "";

  const educationOptions = [
    "High school or less",
    "Some college",
    "Bachelor's degree",
    "Master's degree",
    "Doctoral degree",
    "Prefer not to say"
  ];

  const digitalExperienceOptions = [
    "1 - No Experience",
    "2 - Limited Experience",
    "3 - Moderate Experience",
    "4 - Good Experience",
    "5 - Extensive Experience"
  ];

  const handleContinue = async () => {
    if (allQuestionsAnswered) {
      setIsLoading(true);
      try {
        let sessionId = sessionStorage.getItem('sessionId');
        
        // If no session exists, create one
        if (!sessionId) {
          sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          sessionStorage.setItem('sessionId', sessionId);
          const mode = sessionStorage.getItem('studyMode') as StudyMode || 'text';
          
          // Create session in database
          const { createStudySession } = await import('@/lib/studyData');
          await createStudySession(sessionId, mode);
        }
        
        // Map to database column names
        const responses = {
          age_range: preferNotToSayAge ? "Prefer not to say" : age,
          education: education,
          digital_experience: digitalExperience
        };
        
        await saveDemographics(sessionId, responses);
        sessionStorage.setItem('demographics', JSON.stringify(responses));
        navigate("/pre-test");
      } catch (error) {
        console.error('Error saving demographics:', error);
        toast({
          title: "Error",
          description: "Failed to save your responses. Please try again.",
          variant: "destructive"
        });
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <img src={logo} alt="Majewski Studio" className="h-8" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Background Information</h1>
            <p className="text-muted-foreground">Help us understand your background</p>
          </div>

          <div className="space-y-8">
            {/* Age Question - Text Input */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold">What is your age?</h3>
              <div className="space-y-3">
                <Input
                  type="number"
                  placeholder="Enter your age"
                  value={age}
                  onChange={(e) => {
                    setAge(e.target.value);
                    if (e.target.value) setPreferNotToSayAge(false);
                  }}
                  disabled={preferNotToSayAge}
                  className="max-w-xs"
                  min="1"
                  max="150"
                />
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="prefer-not-age"
                    checked={preferNotToSayAge}
                    onCheckedChange={(checked) => {
                      setPreferNotToSayAge(checked === true);
                      if (checked) setAge("");
                    }}
                  />
                  <Label htmlFor="prefer-not-age" className="cursor-pointer">
                    Prefer not to say
                  </Label>
                </div>
              </div>
            </div>

            {/* Education Question */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold">What is your highest level of education?</h3>
              <RadioGroup
                value={education}
                onValueChange={setEducation}
              >
                <div className="space-y-3">
                  {educationOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-3">
                      <RadioGroupItem value={option} id={`education-${option}`} />
                      <Label 
                        htmlFor={`education-${option}`}
                        className="cursor-pointer flex-1 py-2"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Digital Experience Question */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold">Experience with digital learning platforms</h3>
              <RadioGroup
                value={digitalExperience}
                onValueChange={setDigitalExperience}
              >
                <div className="space-y-3">
                  {digitalExperienceOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-3">
                      <RadioGroupItem value={option} id={`digital-${option}`} />
                      <Label 
                        htmlFor={`digital-${option}`}
                        className="cursor-pointer flex-1 py-2"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleContinue}
            disabled={!allQuestionsAnswered || isLoading}
          >
            {isLoading ? "Saving..." : "Continue to Pre-Test"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Demographics;
