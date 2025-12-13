import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type StudyStep = 
  | 'welcome' 
  | 'consent' 
  | 'demographics' 
  | 'pretest' 
  | 'mode-assignment' 
  | 'learning' 
  | 'posttest1' 
  | 'posttest2' 
  | 'posttest3' 
  | 'completion';

const STEP_REQUIREMENTS: Record<StudyStep, string[]> = {
  'welcome': [],
  'consent': [],
  'demographics': ['sessionId'],
  'pretest': ['sessionId', 'demographics'],
  'mode-assignment': ['sessionId', 'demographics', 'preTest'],
  'learning': ['sessionId', 'demographics', 'preTest', 'studyMode'],
  'posttest1': ['sessionId', 'demographics', 'preTest', 'studyMode'],
  'posttest2': ['sessionId', 'demographics', 'preTest', 'studyMode', 'postTestPage1'],
  'posttest3': ['sessionId', 'demographics', 'preTest', 'studyMode', 'postTestPage1', 'postTestPage2'],
  'completion': ['sessionId', 'demographics', 'preTest', 'studyMode', 'postTestPage1', 'postTestPage2', 'postTestPage3'],
};

const STEP_REDIRECT: Record<StudyStep, string> = {
  'welcome': '/',
  'consent': '/consent',
  'demographics': '/demographics',
  'pretest': '/pre-test',
  'mode-assignment': '/mode-assignment',
  'learning': '/mode-assignment',
  'posttest1': '/post-test-1',
  'posttest2': '/post-test-2',
  'posttest3': '/post-test-3',
  'completion': '/completion',
};

/**
 * Hook that guards study flow by ensuring users complete steps in order.
 * Redirects to the appropriate step if requirements are not met.
 * 
 * @param currentStep - The current step in the study flow
 * @param options - Configuration options
 */
export function useStudyFlowGuard(
  currentStep: StudyStep,
  options: { 
    showToast?: boolean;
    allowedBackSteps?: StudyStep[];
  } = {}
) {
  const navigate = useNavigate();
  const { showToast = true } = options;

  useEffect(() => {
    const requirements = STEP_REQUIREMENTS[currentStep];
    const missingRequirements: string[] = [];

    for (const req of requirements) {
      const value = sessionStorage.getItem(req);
      if (!value) {
        missingRequirements.push(req);
      }
    }

    if (missingRequirements.length > 0) {
      // Find the earliest step that's missing
      let redirectStep: StudyStep = 'consent';
      
      if (!sessionStorage.getItem('sessionId')) {
        redirectStep = 'consent';
      } else if (!sessionStorage.getItem('demographics')) {
        redirectStep = 'demographics';
      } else if (!sessionStorage.getItem('preTest')) {
        redirectStep = 'pretest';
      } else if (!sessionStorage.getItem('studyMode')) {
        redirectStep = 'mode-assignment';
      } else if (!sessionStorage.getItem('postTestPage1')) {
        redirectStep = 'posttest1';
      } else if (!sessionStorage.getItem('postTestPage2')) {
        redirectStep = 'posttest2';
      } else if (!sessionStorage.getItem('postTestPage3')) {
        redirectStep = 'posttest3';
      }

      if (showToast) {
        toast.warning('Please complete the previous steps first.', {
          description: 'You cannot skip ahead in the study.',
          duration: 4000,
        });
      }

      navigate(STEP_REDIRECT[redirectStep], { replace: true });
    }
  }, [currentStep, navigate, showToast]);

  /**
   * Check if a specific step's requirements are met
   */
  const isStepComplete = (step: StudyStep): boolean => {
    const requirements = STEP_REQUIREMENTS[step];
    return requirements.every(req => !!sessionStorage.getItem(req));
  };

  /**
   * Get the current study progress as a percentage
   */
  const getProgress = (): number => {
    const steps: StudyStep[] = [
      'consent', 'demographics', 'pretest', 'mode-assignment', 
      'learning', 'posttest1', 'posttest2', 'posttest3', 'completion'
    ];
    
    let completedSteps = 0;
    for (const step of steps) {
      if (isStepComplete(step)) {
        completedSteps++;
      } else {
        break;
      }
    }
    
    return (completedSteps / steps.length) * 100;
  };

  return {
    isStepComplete,
    getProgress,
  };
}

/**
 * Clears all study session data from sessionStorage.
 * Call this when starting a new study or when a session is invalidated.
 */
export function clearStudySession() {
  const keysToRemove = [
    'sessionId',
    'studyMode',
    'demographics',
    'preTest',
    'postTestPage1',
    'postTestPage2',
    'postTestPage3',
  ];
  
  keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Validates that the current session is still active and hasn't been tampered with.
 */
export function validateSession(): boolean {
  const sessionId = sessionStorage.getItem('sessionId');
  
  // Basic validation - session ID should be a valid UUID format
  if (sessionId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      console.warn('Invalid session ID format detected');
      clearStudySession();
      return false;
    }
  }
  
  return true;
}
