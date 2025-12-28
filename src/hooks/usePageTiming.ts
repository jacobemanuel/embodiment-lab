import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { appendTimingEntry, saveTelemetryMeta } from "@/lib/sessionTelemetry";
import { StudyMode } from "@/types/study";

const MIN_SECONDS = 2;

export const usePageTiming = (pageId: string, pageTitle: string, enabled: boolean = true) => {
  const startRef = useRef<Date | null>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    startRef.current = new Date();
    savedRef.current = false;

    const flushTiming = () => {
      if (!enabled || !startRef.current || savedRef.current) return;
      savedRef.current = true;

      const endTime = new Date();
      const durationSeconds = Math.round((endTime.getTime() - startRef.current.getTime()) / 1000);
      if (durationSeconds < MIN_SECONDS) return;

      appendTimingEntry({
        kind: 'page',
        slideId: `page:${pageId}`,
        slideTitle: `Page: ${pageTitle}`,
        durationSeconds,
        mode: 'page',
        startedAt: startRef.current.toISOString(),
        endedAt: endTime.toISOString(),
      });

      const sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) return;

      supabase.functions.invoke('save-avatar-time', {
        body: {
          sessionId,
          slideId: `page:${pageId}`,
          slideTitle: `Page: ${pageTitle}`,
          startedAt: startRef.current.toISOString(),
          endedAt: endTime.toISOString(),
          durationSeconds,
          mode: 'page',
        },
      }).catch((error) => {
        console.error('Failed to save page timing:', error);
      });
    };

    const handlePageHide = () => {
      flushTiming();
      const sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) return;
      const mode = (sessionStorage.getItem('studyMode') as StudyMode) || 'unknown';
      saveTelemetryMeta(sessionId, mode, { final: false }).catch((error) => {
        console.error('Failed to store telemetry snapshot:', error);
      });
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      flushTiming();
    };
  }, [enabled, pageId, pageTitle]);
};
