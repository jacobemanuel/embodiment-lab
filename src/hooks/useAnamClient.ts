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
  const avatarBufferRef = useRef<string>('');
  const toggleStatsRef = useRef<ToggleStats>({ cameraToggles: 0, micToggles: 0, lastToggleTime: 0 });
  const isUserMicOnRef = useRef(false);
  const isInitializingRef = useRef(false);

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
    // Prevent double initialization
    if (isInitializingRef.current || clientRef.current) {
      console.log('Already initializing or initialized, skipping');
      return;
    }
    isInitializingRef.current = true;

    try {
      setState(prev => ({ ...prev, error: null }));
      
      const sessionToken = await getSessionToken();
      console.log('Creating Anam client with token...');
      const client = createClient(sessionToken);

      // Set up event listeners BEFORE streaming
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

        const isFinal = event.endOfSpeech === true;
        const contentChunk = event.content || '';
        const trimmed = contentChunk.trim();

        // AGGRESSIVE filter: skip any content that looks like JSON, system messages, or slide context
        const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[{');
        const containsJsonKeys = /"(id|title|keyPoints|systemPromptContext|state|toggleCount)"/.test(trimmed);
        const isSystemMessage = trimmed.startsWith('[SYSTEM_EVENT') || 
                                trimmed.startsWith('[SILENT_CONTEXT_UPDATE') ||
                                trimmed.includes('[ACKNOWLEDGED]') ||
                                trimmed.includes('[DO_NOT_SPEAK]');
        
        if (isSystemMessage || looksLikeJson || containsJsonKeys) {
          console.log('Filtering from transcript (JSON/system):', trimmed.substring(0, 60));
          return;
        }

        // Avatar (persona) speaking – show as "Tutor"
        if (event.role === MessageRole.PERSONA || event.role === 'assistant' || event.role === 'persona') {
          // Accumulate full utterance across streaming chunks
          avatarBufferRef.current += contentChunk;

          if (isFinal) {
            const fullContent = avatarBufferRef.current.trim();
            if (fullContent) {
              addTranscriptMessage('avatar', fullContent, true);
            }
            avatarBufferRef.current = '';
          }

          setState(prev => ({ ...prev, isTalking: !isFinal }));
          return;
        }

        // User speech – show as "You" in transcript, but ONLY when mic is ON
        if (event.role === MessageRole.USER || event.role === 'user') {
          if (isUserMicOnRef.current) {
            addTranscriptMessage('user', contentChunk, isFinal);
          } else {
            console.log('Ignoring user speech while mic is OFF');
          }
        }
      });

      clientRef.current = client;

      // Stream to video element
      console.log('Starting stream to video element:', videoElementId);
      await client.streamToVideoElement(videoElementId);

      // HARD-MUTE microphone immediately after stream starts
      // So Alex starts "deaf" until user presses the blue mic button
      try {
        const audioState = client.muteInputAudio();
        console.log('Initial hard mute after stream start:', audioState);
      } catch (err) {
        console.error('Error applying initial hard mute:', err);
      }

    } catch (error) {
      console.error('Error initializing Anam client:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Service temporarily unavailable'
      }));
    } finally {
      isInitializingRef.current = false;
    }
  }, [getSessionToken, addTranscriptMessage, videoElementId]);

  const sendMessage = useCallback(async (message: string) => {
    if (!clientRef.current || !state.isConnected) {
      console.error('Cannot send message: client not connected');
      return;
    }

    try {
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
  }, [state.isConnected]);

  // System event sender - sends SILENT context updates to avatar
  // NOTE: We no longer send slide context via talk() as it causes the avatar to speak JSON
  // Slide context is embedded in the initial system prompt; users can ask about current slide
  const sendSystemEvent = useCallback(async (eventType: string, data: Record<string, any> = {}) => {
    if (!clientRef.current || !state.isConnected) return;
    
    // Only send brief, non-JSON notifications for camera/mic toggles
    // These should NOT include slide data
    if (eventType === 'CAMERA_TOGGLE' || eventType === 'MIC_TOGGLE') {
      const briefMessage = `[SYSTEM_EVENT:${eventType}] ${data.state} [DO_NOT_SPEAK]`;
      console.log('Sending brief system event:', briefMessage);
      try {
        await clientRef.current.talk(briefMessage);
      } catch (error) {
        console.error('Error sending system event:', error);
      }
    }
    // Skip all other system events to prevent avatar from speaking JSON
  }, [state.isConnected]);

  // Slide change notification - NO LONGER sends anything to avatar via talk()
  // The avatar knows the initial slide from session creation, and users can ask questions
  const notifySlideChange = useCallback(async (slide: Slide) => {
    console.log('Slide changed to:', slide.title, '(not sending to avatar - context is in system prompt)');
    // We just update the ref - no talk() call that would make avatar speak JSON
    currentSlideRef.current = slide;
  }, []);

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

  // Push-to-talk controls Anam microphone input via SDK methods
  const startListening = useCallback(() => {
    if (!clientRef.current) {
      console.warn('startListening: no client');
      return;
    }
    isUserMicOnRef.current = true;
    try {
      const audioState = clientRef.current.unmuteInputAudio();
      console.log('startListening – mic UNMUTED, state:', audioState);
    } catch (err) {
      console.error('Error unmuting Anam mic:', err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!clientRef.current) {
      console.warn('stopListening: no client');
      return;
    }
    isUserMicOnRef.current = false;
    try {
      const audioState = clientRef.current.muteInputAudio();
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
    avatarBufferRef.current = '';
    toggleStatsRef.current = { cameraToggles: 0, micToggles: 0, lastToggleTime: 0 };
    isUserMicOnRef.current = false;
    isInitializingRef.current = false;
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
