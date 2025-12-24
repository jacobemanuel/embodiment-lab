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

// Steps that, once completed, cannot be revisited
const STEP_COMPLETION_MARKERS: Record<StudyStep, string> = {
  'welcome': '',
  'consent': 'sessionId', // Once session created, consent is done
  'demographics': 'demographics',
  'pretest': 'preTest',
  'mode-assignment': 'studyMode',
  'learning': 'postTestPage1', // Once post-test starts, learning is done
  'posttest1': 'postTestPage1',
  'posttest2': 'postTestPage2',
  'posttest3': 'postTestPage3',
  'completion': 'studyCompleted',
};

// Forward redirect when trying to go back to completed step
const STEP_FORWARD_REDIRECT: Record<StudyStep, string> = {
  'welcome': '/consent',
  'consent': '/demographics',
  'demographics': '/pre-test',
  'pretest': '/mode-assignment',
  'mode-assignment': '/learning/text', // Will be adjusted based on mode
  'learning': '/post-test-1',
  'posttest1': '/post-test-2',
  'posttest2': '/post-test-3',
  'posttest3': '/completion',
  'completion': '/completion',
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
    // Use polling to wait for sessionStorage to be populated
    // This handles the race condition when navigating from Consent to Demographics
    // where the session creation might still be in progress
    let attempts = 0;
    const maxAttempts = 10; // Max 2 seconds of waiting (10 * 200ms)
    
    const checkRequirements = () => {
      // If study was completed, just redirect to home gracefully (no cheating message)
      const studyCompleted = sessionStorage.getItem('studyCompleted') || localStorage.getItem('studyCompleted');
      if (studyCompleted === 'true' && currentStep !== 'completion') {
        navigate('/', { replace: true });
        return true; // Stop polling
      }
      
      // First check: prevent going back to already completed steps
      // For test pages, check if the next step's data is already saved
      const completionMarker = STEP_COMPLETION_MARKERS[currentStep];
      if (completionMarker && currentStep !== 'completion') {
        // Check if the NEXT step's completion marker exists
        const stepOrder: StudyStep[] = ['consent', 'demographics', 'pretest', 'mode-assignment', 'learning', 'posttest1', 'posttest2', 'posttest3', 'completion'];
        const currentIndex = stepOrder.indexOf(currentStep);
        
        // For test steps, check if we've moved past them
        if (currentStep === 'pretest' && sessionStorage.getItem('studyMode')) {
          // Pre-test completed and mode assigned - can't go back to pre-test
          const mode = sessionStorage.getItem('studyMode');
          toast.warning('You have already completed the pre-test.', {
            description: 'You cannot go back to completed sections.',
            duration: 3000,
          });
          navigate(mode === 'avatar' ? '/learning/avatar' : '/learning/text', { replace: true });
          return true;
        }
        
        if (currentStep === 'posttest1' && sessionStorage.getItem('postTestPage1')) {
          // Post-test page 1 completed - can't go back
          toast.warning('You have already completed this section.', {
            description: 'You cannot go back to completed sections.',
            duration: 3000,
          });
          navigate('/post-test-2', { replace: true });
          return true;
        }
        
        if (currentStep === 'posttest2' && sessionStorage.getItem('postTestPage2')) {
          // Post-test page 2 completed - can't go back
          toast.warning('You have already completed this section.', {
            description: 'You cannot go back to completed sections.',
            duration: 3000,
          });
          navigate('/post-test-3', { replace: true });
          return true;
        }
      }
      
      const requirements = STEP_REQUIREMENTS[currentStep];
      const missingRequirements: string[] = [];

      for (const req of requirements) {
        const value = sessionStorage.getItem(req);
        if (!value) {
          missingRequirements.push(req);
        }
      }

      // If all requirements are met, we're good
      if (missingRequirements.length === 0) {
        return true; // Stop polling
      }

      // For demographics step, give more time for session creation
      // Only redirect after multiple failed attempts
      attempts++;
      if (attempts < maxAttempts && currentStep === 'demographics' && missingRequirements.includes('sessionId')) {
        return false; // Keep polling
      }

      // Max attempts reached or not demographics step - redirect
      if (attempts >= maxAttempts || currentStep !== 'demographics') {
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
        return true; // Stop polling
      }

      return false; // Keep polling
    };

    // Initial check
    if (checkRequirements()) {
      return;
    }

    // Set up polling interval
    const intervalId = setInterval(() => {
      if (checkRequirements()) {
        clearInterval(intervalId);
      }
    }, 200);

    return () => clearInterval(intervalId);
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
    'studyCompleted',
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
