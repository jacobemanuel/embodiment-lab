import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { clearStudySession } from './useStudyFlowGuard';
import { enqueueEdgeCall } from '@/lib/edgeQueue';

const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_TIMEOUT = 5 * 60 * 1000; // 5 minutes before timeout
const ACTIVITY_UPDATE_INTERVAL = 60 * 1000; // Update activity every 1 minute

interface UseSessionTimeoutOptions {
  enabled?: boolean;
  onTimeout?: () => void;
  onWarning?: () => void;
}

export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const { enabled = true, onTimeout, onWarning } = options;
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const activityUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const warningCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIMEOUT_DURATION);

  const updateServerActivity = useCallback(async () => {
    const sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) return;

    try {
      await supabase.functions.invoke('save-study-data', {
        body: {
          action: 'update_activity',
          sessionId
        }
      });
    } catch (error) {
      console.error('Failed to update activity:', error);
      enqueueEdgeCall(
        'save-study-data',
        { action: 'update_activity', sessionId },
        { dedupeKey: `update_activity:${sessionId}` }
      );
    }
  }, []);

  const handleTimeout = useCallback(async () => {
    const sessionId = sessionStorage.getItem('sessionId');
    
    // Mark session as abandoned due to timeout
    if (sessionId) {
      try {
        await supabase.functions.invoke('save-study-data', {
          body: {
            action: 'reset_session',
            sessionId,
            reason: 'timeout'
          }
        });
      } catch (error) {
        console.error('Failed to mark session as timed out:', error);
        enqueueEdgeCall('save-study-data', {
          action: 'reset_session',
          sessionId,
          reason: 'timeout',
        });
      }
    }

    clearStudySession();
    
    toast.error('Session expired due to inactivity', {
      description: 'Please start the study again.',
      duration: 8000,
    });

    onTimeout?.();
    navigate('/', { replace: true });
  }, [navigate, onTimeout]);

  const handleWarning = useCallback(() => {
    setShowWarning(true);
    onWarning?.();
    
    toast.warning('Session expiring soon!', {
      description: 'Your session will expire in 5 minutes due to inactivity. Move your mouse or click to stay active.',
      duration: 10000,
    });

    // Start countdown
    if (warningCountdownRef.current) {
      clearInterval(warningCountdownRef.current);
    }
    warningCountdownRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          if (warningCountdownRef.current) {
            clearInterval(warningCountdownRef.current);
            warningCountdownRef.current = null;
          }
        }
        return newTime;
      });
    }, 1000);
  }, [onWarning]);

  const resetTimeout = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setTimeRemaining(TIMEOUT_DURATION);

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (warningCountdownRef.current) {
      clearInterval(warningCountdownRef.current);
      warningCountdownRef.current = null;
    }

    // Set warning timer (25 minutes)
    warningRef.current = setTimeout(() => {
      handleWarning();
    }, TIMEOUT_DURATION - WARNING_BEFORE_TIMEOUT);

    // Set timeout timer (30 minutes)
    timeoutRef.current = setTimeout(() => {
      handleTimeout();
    }, TIMEOUT_DURATION);
  }, [handleTimeout, handleWarning]);

  useEffect(() => {
    if (!enabled) return;

    const sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) return;

    // Initialize timeout
    resetTimeout();

    // Activity events
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      const now = Date.now();
      // Only reset if more than 1 second since last activity (debounce)
      if (now - lastActivityRef.current > 1000) {
        resetTimeout();
      }
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Update server activity periodically
    activityUpdateRef.current = setInterval(() => {
      updateServerActivity();
    }, ACTIVITY_UPDATE_INTERVAL);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (activityUpdateRef.current) clearInterval(activityUpdateRef.current);
      if (warningCountdownRef.current) {
        clearInterval(warningCountdownRef.current);
        warningCountdownRef.current = null;
      }
    };
  }, [enabled, resetTimeout, updateServerActivity]);

  return {
    showWarning,
    timeRemaining,
    resetTimeout,
  };
}
