import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo-white.png";
import ParticipantFooter from "@/components/ParticipantFooter";
import { supabase } from "@/integrations/supabase/client";

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
  const handleDownloadData = async () => {
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
      const scenarioFeedback = JSON.parse(sessionStorage.getItem('scenarioFeedback') || '[]');
      const dialogueLog = JSON.parse(sessionStorage.getItem('dialogueLog') || '[]');

      const demographicSnapshot = JSON.parse(sessionStorage.getItem('demographicQuestionsSnapshot') || '[]');
      const preTestSnapshot = JSON.parse(sessionStorage.getItem('preTestQuestionsSnapshot') || '[]');
      const postTestSnapshot = JSON.parse(sessionStorage.getItem('postTestQuestionsSnapshot') || '[]');

      const questionTextMap: Record<string, string> = {};
      const questionMetaMap: Record<string, { category?: string; type?: string }> = {};

      const registerSnapshot = (snapshot: Array<{ id: string; text: string; category?: string; type?: string }>) => {
        snapshot.forEach((q) => {
          questionTextMap[q.id] = q.text;
          questionMetaMap[q.id] = { category: q.category, type: q.type };
        });
      };

      registerSnapshot(demographicSnapshot);
      registerSnapshot(preTestSnapshot);
      registerSnapshot(postTestSnapshot);

      const allQuestionIds = Array.from(new Set([
        ...Object.keys(demographics || {}),
        ...Object.keys(preTest || {}),
        ...Object.keys(postTest || {}),
      ]));

      const missingQuestionIds = allQuestionIds.filter((id) => !questionTextMap[id]);
      if (missingQuestionIds.length > 0) {
        const { data: questionRows } = await supabase
          .from('study_questions_public')
          .select('question_id, question_text, category, question_meta')
          .in('question_id', missingQuestionIds);

        if (questionRows && Array.isArray(questionRows)) {
          questionRows.forEach((row: any) => {
            questionTextMap[row.question_id] = row.question_text;
            const meta = typeof row.question_meta === 'string' ? JSON.parse(row.question_meta) : row.question_meta || {};
            questionMetaMap[row.question_id] = {
              category: row.category || meta?.category,
              type: meta?.type,
            };
          });
        }
      }

      const escapeCsv = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const formatAnswer = (answer: string) => String(answer || '').split('|||').join('; ');
      const addRow = (category: string, question: string, response: string | number | boolean) => {
        csvContent += [
          escapeCsv(category),
          escapeCsv(question),
          escapeCsv(String(response ?? '')),
        ].join(',') + '\n';
      };
      
      // Create CSV content
      let csvContent = 'Category,Question,Response\n';
      
      // Add session info
      addRow('Session Info', 'Session ID', sessionId);
      addRow('Session Info', 'Mode', mode);
      csvContent += '\n';
      
      // Add demographics
      const demographicOrder = demographicSnapshot.length > 0
        ? demographicSnapshot
        : Object.keys(demographics || {}).map((id) => ({ id, text: questionTextMap[id] || id }));
      demographicOrder.forEach((q) => {
        const answer = demographics[q.id] ?? '';
        addRow('Demographics', questionTextMap[q.id] || q.text || q.id, formatAnswer(answer));
      });
      csvContent += '\n';
      
      // Add pre-test responses
      const preTestOrder = preTestSnapshot.length > 0
        ? preTestSnapshot
        : Object.keys(preTest || {}).map((id) => ({ id, text: questionTextMap[id] || id }));
      preTestOrder.forEach((q) => {
        const answer = preTest[q.id] ?? '';
        addRow('Pre-Test', questionTextMap[q.id] || q.text || q.id, formatAnswer(answer));
      });
      csvContent += '\n';
      
      const postTestOrder = postTestSnapshot.length > 0
        ? postTestSnapshot
        : Object.keys(postTest || {}).map((id) => ({ id, text: questionTextMap[id] || id }));
      const perceptionCategories = ['expectations', 'avatar-qualities', 'realism', 'trust', 'engagement', 'satisfaction'];
      const categorizePostTest = (questionId: string) => {
        const meta = questionMetaMap[questionId] || {};
        if (meta.category === 'knowledge' || questionId.startsWith('knowledge-')) return 'Post-Test (Knowledge)';
        if (
          meta.category === 'open_feedback' ||
          meta.type === 'open_feedback' ||
          meta.type === 'open' ||
          meta.type === 'text' ||
          questionId.startsWith('open_')
        ) {
          return 'Post-Test (Open Feedback)';
        }
        if (meta.type === 'likert' || (meta.category && perceptionCategories.includes(meta.category))) {
          return 'Post-Test (Likert)';
        }
        return 'Post-Test (Other)';
      };
      postTestOrder.forEach((q) => {
        const answer = postTest[q.id] ?? '';
        addRow(categorizePostTest(q.id), questionTextMap[q.id] || q.text || q.id, formatAnswer(answer));
      });

      if (scenarioFeedback.length > 0) {
        csvContent += '\n';
        scenarioFeedback.forEach((entry: any) => {
          const label = entry.scenarioTitle || entry.scenarioId || 'Scenario';
          addRow('Scenario Feedback', `${label} - Confidence`, entry.confidenceRating ?? '');
          addRow('Scenario Feedback', `${label} - Trust`, entry.trustRating ?? '');
          addRow('Scenario Feedback', `${label} - Engagement`, entry.engagementRating ? 'Yes' : 'No');
        });
      }

      csvContent += '\n';
      if (dialogueLog.length > 0) {
        dialogueLog.forEach((entry: any) => {
          const label = entry.scenarioTitle || entry.scenarioId || 'Scenario';
          const messages = Array.isArray(entry.messages) ? entry.messages : [];
          messages.forEach((message: any) => {
            const role = message.role === 'user' ? 'User' : 'AI';
            addRow('Dialogue', `${label} (${role})`, message.content || '');
          });
        });
      } else {
        addRow('Dialogue', 'No dialogues recorded', '');
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
      <ParticipantFooter />
    </div>
  );
};

export default Completion;
