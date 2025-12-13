import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient, AnamEvent, MessageRole } from '@anam-ai/js-sdk';
import type { AnamClient } from '@anam-ai/js-sdk';
import { Slide } from '@/data/slides';
import { TranscriptMessage } from '@/components/TranscriptPanel';
import { supabase } from '@/integrations/supabase/client';

interface UseAnamClientProps {
  onTranscriptUpdate?: (messages: TranscriptMessage[]) => void;
  currentSlide: Slide;
  videoElementId: string;
}

interface AnamState {
  isConnected: boolean;
  isStreaming: boolean;
  isTalking: boolean;
  error: string | null;
}

// Track toggle counts for spam detection
interface ToggleStats {
  cameraToggles: number;
  micToggles: number;
  lastToggleTime: number;
}

export const useAnamClient = ({ onTranscriptUpdate, currentSlide, videoElementId }: UseAnamClientProps) => {
  const [state, setState] = useState<AnamState>({
    isConnected: false,
    isStreaming: false,
    isTalking: false,
    error: null,
  });

  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);
  const clientRef = useRef<AnamClient | null>(null);
  const currentSlideRef = useRef<Slide>(currentSlide);
  const processedMessagesRef = useRef<Record<string, string>>({});
  const toggleStatsRef = useRef<ToggleStats>({ cameraToggles: 0, micToggles: 0, lastToggleTime: 0 });

  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  useEffect(() => {
    onTranscriptUpdate?.(transcriptMessages);
  }, [transcriptMessages, onTranscriptUpdate]);

  // Add transcript message – keep EXACT text (no noise filtering)
  const addTranscriptMessage = useCallback((role: 'user' | 'avatar', content: string, isFinal: boolean = true) => {
    if (!content || !content.trim()) return;

    setTranscriptMessages(prev => {
      const lastMessage = prev[prev.length - 1];

      // If we are still streaming the same utterance for this role, update it
      if (lastMessage && lastMessage.role === role && !lastMessage.isFinal) {
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content, isFinal }
        ];
      }

      // Otherwise append a new message
      return [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role,
          content,
          timestamp: Date.now(),
          isFinal,
        },
      ];
    });
  }, []);

  const getSessionToken = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('anam-session', {
      body: {
        slideContext: {
          id: currentSlideRef.current.id,
          title: currentSlideRef.current.title,
          keyPoints: currentSlideRef.current.keyPoints,
          systemPromptContext: currentSlideRef.current.systemPromptContext
        }
      }
    });

    if (error) {
      console.error('Error getting Anam session:', error);
      throw new Error('Service temporarily unavailable');
    }

    console.log('Got session token:', data.sessionToken ? 'YES' : 'NO');
    return data.sessionToken;
  }, []);

  const initializeClient = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const sessionToken = await getSessionToken();
      console.log('Creating Anam client with token...');
      const client = createClient(sessionToken);

      // Do NOT change mic state before the stream starts – we'll control it
      // explicitly via the push-to-talk button once streaming is active.

      // Set up event listeners
      client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
        console.log('Anam connection established');
        setState(prev => ({ ...prev, isConnected: true }));
      });

      client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
        console.log('Anam connection closed');
        setState(prev => ({ ...prev, isConnected: false, isStreaming: false, isTalking: false }));
      });

      client.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => {
        console.log('Anam video started');
        setState(prev => ({ ...prev, isStreaming: true }));
      });

      // Stream events - source of truth for avatar + user transcript
      client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (event: any) => {
        console.log('Stream event:', event, 'role:', event.role, 'endOfSpeech:', event.endOfSpeech);

        const isFinal = event.endOfSpeech === undefined ? true : event.endOfSpeech;
        const contentChunk = event.content || '';
        const trimmed = contentChunk.trim();

        // Ignore low-level system-event payloads that we send as hidden context
        if (trimmed.startsWith('[SYSTEM_EVENT')) {
          console.log('Skipping system-event chunk from transcript');
          return;
        }

        // Avatar (persona) speaking – show as "Tutor"
        if (event.role === MessageRole.PERSONA || event.role === 'assistant' || event.role === 'persona') {
          // Accumulate full utterance across streaming chunks. Anam often sends
          // many small pieces where the *final* event has empty content but
          // endOfSpeech=true, so we must buffer everything ourselves.
          const bufferKey = 'avatar-buffer';
          (processedMessagesRef.current as any)[bufferKey] = ((processedMessagesRef.current as any)[bufferKey] || '') + contentChunk;
          const fullContent = (processedMessagesRef.current as any)[bufferKey] as string;

          if (isFinal) {
            addTranscriptMessage('avatar', fullContent, true);
            (processedMessagesRef.current as any)[bufferKey] = '';
          }

          setState(prev => ({ ...prev, isTalking: !isFinal }));
          return;
        }

        // User speech – show as "You" in transcript
        if (event.role === MessageRole.USER || event.role === 'user') {
          addTranscriptMessage('user', contentChunk, isFinal);
        }
      });

      clientRef.current = client;

      // Stream to video element
      console.log('Starting stream to video element:', videoElementId);
      await client.streamToVideoElement(videoElementId);
      // NOTE: Let Anam manage microphone defaults itself.
      // We keep push-to-talk purely as a visual/helper control for now so that
      // we don't accidentally block audio input.

    } catch (error) {
      console.error('Error initializing Anam client:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Service temporarily unavailable'
      }));
    }
  }, [getSessionToken, addTranscriptMessage, videoElementId]);

  const sendMessage = useCallback(async (message: string) => {
    if (!clientRef.current || !state.isConnected) {
      console.error('Cannot send message: client not connected');
      return;
    }

    try {
      // We no longer add user messages to the transcript here –
      // transcript should show ONLY what Alex says.
      console.log('Sending message to avatar:', message);
      await clientRef.current.talk(message);
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Service temporarily unavailable'
      }));
    }
  }, [state.isConnected, addTranscriptMessage]);

  const notifySlideChange = useCallback(async (slide: Slide) => {
    // Don't auto-speak on slide change - let user ask questions
    console.log('Slide changed to:', slide.title);
  }, []);

  // System event sender - sends invisible context to avatar
  const sendSystemEvent = useCallback(async (eventType: string, data: Record<string, any> = {}) => {
    if (!clientRef.current || !state.isConnected) return;
    
    const eventMessage = `[SYSTEM_EVENT: ${eventType}] ${JSON.stringify(data)}`;
    console.log('Sending system event:', eventMessage);
    
    try {
      await clientRef.current.talk(eventMessage);
    } catch (error) {
      console.error('Error sending system event:', error);
    }
  }, [state.isConnected]);

  // Camera toggle notification with spam detection
  const notifyCameraToggle = useCallback(async (isOn: boolean) => {
    const now = Date.now();
    const stats = toggleStatsRef.current;
    
    // Reset counter if more than 10 seconds since last toggle
    if (now - stats.lastToggleTime > 10000) {
      stats.cameraToggles = 0;
    }
    
    stats.cameraToggles++;
    stats.lastToggleTime = now;
    
    // Determine response type based on toggle frequency
    let responseHint = 'normal';
    if (stats.cameraToggles >= 5) {
      responseHint = 'spam_annoyed';
    } else if (stats.cameraToggles >= 3) {
      responseHint = 'playful_notice';
    } else if (Math.random() > 0.6) {
      // 40% chance to not respond at all for natural feel
      responseHint = 'silent';
    }
    
    if (responseHint !== 'silent') {
      await sendSystemEvent('CAMERA_TOGGLE', { 
        state: isOn ? 'on' : 'off', 
        toggleCount: stats.cameraToggles,
        responseHint 
      });
    }
  }, [sendSystemEvent]);

  // Mic toggle notification with spam detection
  const notifyMicToggle = useCallback(async (isOn: boolean) => {
    const now = Date.now();
    const stats = toggleStatsRef.current;
    
    // Reset counter if more than 10 seconds since last toggle
    if (now - stats.lastToggleTime > 10000) {
      stats.micToggles = 0;
    }
    
    stats.micToggles++;
    stats.lastToggleTime = now;
    
    // Mic toggles - respond less frequently
    let responseHint = 'silent'; // Default silent for mic
    if (stats.micToggles >= 5) {
      responseHint = 'spam_annoyed';
    } else if (stats.micToggles >= 3) {
      responseHint = 'playful_notice';
    } else if (Math.random() > 0.8) {
      // Only 20% chance to respond to normal mic toggle
      responseHint = 'brief';
    }
    
    if (responseHint !== 'silent') {
      await sendSystemEvent('MIC_TOGGLE', { 
        state: isOn ? 'on' : 'off', 
        toggleCount: stats.micToggles,
        responseHint 
      });
    }
  }, [sendSystemEvent]);

  // Push-to-talk actually controls Anam microphone input
  const startListening = useCallback(() => {
    if (!clientRef.current) return;
    try {
      const audioState = (clientRef.current as any).unmuteInputAudio?.();
      console.log('startListening – mic UNMUTED, state:', audioState);
    } catch (err) {
      console.error('Error unmuting Anam mic:', err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!clientRef.current) return;
    try {
      const audioState = (clientRef.current as any).muteInputAudio?.();
      console.log('stopListening – mic MUTED, state:', audioState);
    } catch (err) {
      console.error('Error muting Anam mic:', err);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stopStreaming();
      clientRef.current = null;
    }
    setState({ isConnected: false, isStreaming: false, isTalking: false, error: null });
    processedMessagesRef.current = {};
    toggleStatsRef.current = { cameraToggles: 0, micToggles: 0, lastToggleTime: 0 };
  }, []);

  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  return {
    ...state,
    transcriptMessages,
    initializeClient,
    sendMessage,
    notifySlideChange,
    notifyCameraToggle,
    notifyMicToggle,
    startListening,
    stopListening,
    disconnect,
  };
};
