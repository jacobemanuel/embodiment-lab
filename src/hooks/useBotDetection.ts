import { useRef, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUSPICION_THRESHOLDS } from '@/lib/suspicion';

const {
  minTimePerQuestionMs,
  minTimeForReadingSlideMs,
  minTimeForDemographicsMs,
  minTimeForPretestMs,
  minTimeForPosttestMs,
  minLearningSlides,
  maxFastAnswerRatio,
  minAverageAnswerTimeMs,
} = SUSPICION_THRESHOLDS;

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
      
      if (answerTime < minTimePerQuestionMs) {
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
      'demographics': minTimeForDemographicsMs,
      'pretest': minTimeForPretestMs,
      'posttest': minTimeForPosttestMs,
      'learning': minTimeForReadingSlideMs * minLearningSlides,
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
      if (fastAnswerRatio > maxFastAnswerRatio) {
        flags.push(`${Math.round(fastAnswerRatio * 100)}% of answers were suspiciously fast`);
        score += 25;
      }
    }

    // Check average answer time
    if (totalQuestions > 0 && data.totalAnswerTime > 0) {
      const avgAnswerTime = data.totalAnswerTime / totalQuestions;
      if (avgAnswerTime < minAverageAnswerTimeMs) {
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
      
      if (avgSlideTime < minTimeForReadingSlideMs && slideViews.length > 0) {
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
    console.warn('save-study-data report_suspicious failed, falling back to direct update:', error);
    try {
      const { data: session } = await supabase
        .from('study_sessions')
        .select('suspicious_flags, suspicion_score')
        .eq('session_id', sessionId)
        .maybeSingle();

      const existingFlags = Array.isArray(session?.suspicious_flags) ? session?.suspicious_flags : [];
      const mergedFlags = Array.from(new Set([...existingFlags, ...result.flags]));
      const existingScore = typeof session?.suspicion_score === 'number' ? session.suspicion_score : 0;
      const nextScore = Math.max(existingScore, result.score);

      await supabase
        .from('study_sessions')
        .update({
          suspicious_flags: mergedFlags,
          suspicion_score: nextScore,
          last_activity_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);
    } catch (fallbackError) {
      console.error('Failed to log suspicious activity via fallback:', fallbackError);
    }
  }
}
