import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo-white.png";
import { preTestQuestions } from "@/data/questions";
import { postTestQuestions } from "@/data/postTestQuestions";

const Completion = () => {
  const navigate = useNavigate();
  
  // Mark that user has completed the study - so back button doesn't trigger cheating detection
  useEffect(() => {
    sessionStorage.setItem('studyCompleted', 'true');
    localStorage.setItem('studyCompleted', 'true');
    
    // Handle browser back button - redirect to home gracefully
    const handlePopState = () => {
      // User already completed, just take them home without cheating flag
      navigate('/', { replace: true });
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // Push a state so back button triggers our handler
    window.history.pushState(null, '', window.location.href);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);
  const handleDownloadData = () => {
    try {
      // Gather all data from sessionStorage
      const sessionId = sessionStorage.getItem('sessionId') || 'unknown';
      const demographics = JSON.parse(sessionStorage.getItem('demographics') || '{}');
      const preTest = JSON.parse(sessionStorage.getItem('preTest') || '{}');
      const postTestPage1 = JSON.parse(sessionStorage.getItem('postTestPage1') || '{}');
      const postTestPage2 = JSON.parse(sessionStorage.getItem('postTestPage2') || '{}');
      const postTestPage3 = JSON.parse(sessionStorage.getItem('postTestPage3') || '{}');
      const postTest = { ...postTestPage1, ...postTestPage2, ...postTestPage3 };
      const mode = sessionStorage.getItem('studyMode') || 'unknown';
      
      // Create CSV content
      let csvContent = 'Category,Question,Response\n';
      
      // Add session info
      csvContent += `Session Info,Session ID,${sessionId}\n`;
      csvContent += `Session Info,Mode,${mode}\n`;
      csvContent += '\n';
      
      // Add demographics
      csvContent += 'Demographics,Age Range,' + (demographics['demo-age'] || '') + '\n';
      csvContent += 'Demographics,Education,' + (demographics['demo-education'] || '') + '\n';
      csvContent += 'Demographics,Tax Experience,' + (demographics['demo-tax-experience'] || '') + '\n';
      csvContent += '\n';
      
      // Add pre-test responses
      preTestQuestions.forEach(q => {
        const answer = preTest[q.id] || '';
        csvContent += `Pre-Test,"${q.text.replace(/"/g, '""')}","${answer.replace(/"/g, '""')}"\n`;
      });
      csvContent += '\n';
      
      // Add post-test responses (Likert)
      const likertQuestions = postTestQuestions.filter(q => q.type === 'likert');
      likertQuestions.forEach(q => {
        const answer = postTest[q.id] || '';
        csvContent += `Post-Test (Likert),"${q.text.replace(/"/g, '""')}",${answer}\n`;
      });
      csvContent += '\n';
      
      // Add post-test responses (Knowledge)
      const knowledgeQuestions = postTestQuestions.filter(q => q.category === 'knowledge');
      knowledgeQuestions.forEach(q => {
        const answer = postTest[q.id] || '';
        csvContent += `Post-Test (Knowledge),"${q.text.replace(/"/g, '""')}","${answer.replace(/"/g, '""')}"\n`;
      });

      // Add open feedback or other post-test responses not in the static list
      const knownPostTestIds = new Set(postTestQuestions.map(q => q.id));
      const openFeedbackIds = Object.keys(postTestPage3 || {});
      const otherPostTestIds = Object.keys(postTest || {}).filter(id => !knownPostTestIds.has(id) && !openFeedbackIds.includes(id));

      if (openFeedbackIds.length > 0) {
        csvContent += '\n';
        openFeedbackIds.forEach((id) => {
          const answer = postTest[id] || '';
          csvContent += `Post-Test (Open Feedback),"${id}","${String(answer).replace(/"/g, '""')}"\n`;
        });
      }

      if (otherPostTestIds.length > 0) {
        csvContent += '\n';
        otherPostTestIds.forEach((id) => {
          const answer = postTest[id] || '';
          csvContent += `Post-Test (Other),"${id}","${String(answer).replace(/"/g, '""')}"\n`;
        });
      }
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `study-responses-${sessionId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating CSV:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <img src={logo} alt="TUM Logo" className="h-8" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10">
            <CheckCircle2 className="w-16 h-16 text-primary" />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold">Thank You!</h1>
            <p className="text-xl text-muted-foreground max-w-lg mx-auto text-justify">
              You've completed the AI image generation study. Your responses have been recorded and will help improve AI-powered educational systems.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold">What You Learned</h2>
              <p className="text-muted-foreground leading-relaxed text-justify">
                You explored the fundamentals of AI image generation, including prompt engineering, negative prompts, 
                style control parameters (CFG scale, seed), aspect ratios, and advanced techniques like img2img and inpainting. 
                You also practiced generating images in real-time using the AI playground. These concepts form the foundation 
                for creative AI-powered content creation.
              </p>
            </div>

            <div className="bg-secondary/50 rounded-xl p-6 space-y-3">
              <h3 className="font-semibold">Your Data is Secure</h3>
              <p className="text-sm text-muted-foreground leading-relaxed text-justify">
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
              Contact: <a href="mailto:contact@majewski.studio" className="text-primary hover:underline">contact@majewski.studio</a> | <a href="https://majewski.studio" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">majewski.studio</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Completion;
