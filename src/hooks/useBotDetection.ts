import { useRef, useCallback, useEffect, useState } from 'react';

// Minimum expected times (in milliseconds) for various actions
const MIN_TIME_PER_QUESTION = 3000; // 3 seconds minimum per question
const MIN_TIME_FOR_PAGE = 5000; // 5 seconds minimum per page
const MIN_TIME_FOR_READING_SLIDE = 8000; // 8 seconds minimum to read a slide
const MIN_TIME_FOR_DEMOGRAPHICS = 15000; // 15 seconds for demographics page
const MIN_TIME_FOR_PRETEST = 30000; // 30 seconds for pre-test (multiple questions)
const MIN_TIME_FOR_POSTTEST = 45000; // 45 seconds for post-test pages

// Suspicion levels
type SuspicionLevel = 'none' | 'low' | 'medium' | 'high';

interface TimingData {
  pageEnterTime: number;
  questionTimes: Record<string, number>;
  slideViewTimes: Record<string, number>;
  totalAnswerTime: number;
  fastAnswerCount: number;
  pageTransitionTimes: number[];
}

interface BotDetectionResult {
  suspicionLevel: SuspicionLevel;
  flags: string[];
  score: number;
}

interface UseBotDetectionOptions {
  pageType: 'demographics' | 'pretest' | 'posttest' | 'learning';
  onSuspiciousActivity?: (result: BotDetectionResult) => void;
}

export function useBotDetection(options: UseBotDetectionOptions) {
  const { pageType, onSuspiciousActivity } = options;
  const [suspicionLevel, setSuspicionLevel] = useState<SuspicionLevel>('none');
  const [detectionResult, setDetectionResult] = useState<BotDetectionResult | null>(null);
  
  const timingData = useRef<TimingData>({
    pageEnterTime: Date.now(),
    questionTimes: {},
    slideViewTimes: {},
    totalAnswerTime: 0,
    fastAnswerCount: 0,
    pageTransitionTimes: [],
  });

  // Record when page was entered
  useEffect(() => {
    timingData.current.pageEnterTime = Date.now();
  }, []);

  // Track time spent on a question
  const recordQuestionStart = useCallback((questionId: string) => {
    timingData.current.questionTimes[questionId] = Date.now();
  }, []);

  // Track when a question is answered
  const recordQuestionAnswer = useCallback((questionId: string) => {
    const startTime = timingData.current.questionTimes[questionId];
    if (startTime) {
      const answerTime = Date.now() - startTime;
      timingData.current.totalAnswerTime += answerTime;
      
      if (answerTime < MIN_TIME_PER_QUESTION) {
        timingData.current.fastAnswerCount++;
      }
    }
  }, []);

  // Track slide view time
  const recordSlideView = useCallback((slideId: string, duration: number) => {
    timingData.current.slideViewTimes[slideId] = duration;
  }, []);

  // Analyze timing data and detect suspicious patterns
  const analyzeTimingData = useCallback((): BotDetectionResult => {
    const data = timingData.current;
    const flags: string[] = [];
    let score = 0;

    const timeOnPage = Date.now() - data.pageEnterTime;
    const minTimeForPage = {
      'demographics': MIN_TIME_FOR_DEMOGRAPHICS,
      'pretest': MIN_TIME_FOR_PRETEST,
      'posttest': MIN_TIME_FOR_POSTTEST,
      'learning': MIN_TIME_FOR_READING_SLIDE * 3, // At least 3 slides worth
    }[pageType];

    // Check if page was completed too quickly
    if (timeOnPage < minTimeForPage) {
      flags.push(`Page completed in ${Math.round(timeOnPage / 1000)}s (minimum expected: ${Math.round(minTimeForPage / 1000)}s)`);
      score += 30;
    }

    // Check for too many fast answers
    const totalQuestions = Object.keys(data.questionTimes).length;
    if (totalQuestions > 0) {
      const fastAnswerRatio = data.fastAnswerCount / totalQuestions;
      if (fastAnswerRatio > 0.5) {
        flags.push(`${Math.round(fastAnswerRatio * 100)}% of answers were suspiciously fast`);
        score += 25;
      }
    }

    // Check average answer time
    if (totalQuestions > 0 && data.totalAnswerTime > 0) {
      const avgAnswerTime = data.totalAnswerTime / totalQuestions;
      if (avgAnswerTime < MIN_TIME_PER_QUESTION / 2) {
        flags.push(`Average answer time: ${Math.round(avgAnswerTime / 1000)}s (very fast)`);
        score += 20;
      }
    }

    // Check slide view times (for learning page)
    if (pageType === 'learning') {
      const slideViews = Object.values(data.slideViewTimes);
      const avgSlideTime = slideViews.length > 0 
        ? slideViews.reduce((a, b) => a + b, 0) / slideViews.length 
        : 0;
      
      if (avgSlideTime < MIN_TIME_FOR_READING_SLIDE && slideViews.length > 0) {
        flags.push(`Average slide view time: ${Math.round(avgSlideTime / 1000)}s (too fast to read)`);
        score += 25;
      }
    }

    // Determine suspicion level based on score
    let level: SuspicionLevel = 'none';
    if (score >= 60) level = 'high';
    else if (score >= 40) level = 'medium';
    else if (score >= 20) level = 'low';

    const result: BotDetectionResult = { suspicionLevel: level, flags, score };
    
    setDetectionResult(result);
    setSuspicionLevel(level);
    
    if (level !== 'none' && onSuspiciousActivity) {
      onSuspiciousActivity(result);
    }

    return result;
  }, [pageType, onSuspiciousActivity]);

  // Get current timing summary
  const getTimingSummary = useCallback(() => {
    const data = timingData.current;
    return {
      timeOnPage: Date.now() - data.pageEnterTime,
      questionsAnswered: Object.keys(data.questionTimes).length,
      fastAnswers: data.fastAnswerCount,
      averageAnswerTime: data.totalAnswerTime / Math.max(Object.keys(data.questionTimes).length, 1),
    };
  }, []);

  // Reset timing data (e.g., when moving to a new section)
  const resetTimingData = useCallback(() => {
    timingData.current = {
      pageEnterTime: Date.now(),
      questionTimes: {},
      slideViewTimes: {},
      totalAnswerTime: 0,
      fastAnswerCount: 0,
      pageTransitionTimes: [],
    };
    setSuspicionLevel('none');
    setDetectionResult(null);
  }, []);

  return {
    suspicionLevel,
    detectionResult,
    recordQuestionStart,
    recordQuestionAnswer,
    recordSlideView,
    analyzeTimingData,
    getTimingSummary,
    resetTimingData,
  };
}

/**
 * Utility to log suspicious activity to the server
 */
export async function logSuspiciousActivity(
  sessionId: string,
  result: BotDetectionResult,
  pageType: string
) {
  try {
    // Import supabase client dynamically to avoid circular dependencies
    const { supabase } = await import('@/integrations/supabase/client');
    
    await supabase.functions.invoke('save-study-data', {
      body: {
        action: 'report_suspicious',
        sessionId,
        flags: result.flags,
        score: result.score,
        pageType,
      }
    });
    
    console.log('Suspicious activity reported to server:', {
      sessionId,
      pageType,
      suspicionLevel: result.suspicionLevel,
      score: result.score,
    });
  } catch (error) {
    console.error('Failed to log suspicious activity:', error);
  }
}
