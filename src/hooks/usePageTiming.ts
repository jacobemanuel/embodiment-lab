import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const MIN_SECONDS = 2;

export const usePageTiming = (pageId: string, pageTitle: string, enabled: boolean = true) => {
  const startRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;
    startRef.current = new Date();

    return () => {
      if (!enabled || !startRef.current) return;
      const sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) return;

      const endTime = new Date();
      const durationSeconds = Math.round((endTime.getTime() - startRef.current.getTime()) / 1000);
      if (durationSeconds < MIN_SECONDS) return;

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
  }, [enabled, pageId, pageTitle]);
};
