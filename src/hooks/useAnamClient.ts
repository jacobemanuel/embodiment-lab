import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient, AnamEvent, MessageRole } from '@anam-ai/js-sdk';
import type { AnamClient } from '@anam-ai/js-sdk';
import { Slide } from '@/data/slides';
import { TranscriptMessage } from '@/components/TranscriptPanel';
import { supabase } from '@/integrations/supabase/client';
import { upsertTutorDialogue } from '@/lib/tutorDialogue';

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

type PendingTranscript = {
  timestamp: number;
  lastLoggedAt: number;
  content: string;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

const TRANSCRIPT_UPSERT_INTERVAL_MS = 1200;
const TRANSCRIPT_IDLE_FLUSH_MS = 1500;

const mergeStreamingChunk = (buffer: string, chunk: string) => {
  if (!chunk) return buffer;
  if (!buffer) return chunk;
  if (chunk.startsWith(buffer)) return chunk;
  if (buffer.endsWith(chunk)) return buffer;
  return buffer + chunk;
};

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
  const userBufferRef = useRef<string>('');
  const pendingTranscriptRef = useRef<{ avatar?: PendingTranscript; user?: PendingTranscript }>({});
  const toggleStatsRef = useRef<ToggleStats>({ cameraToggles: 0, micToggles: 0, lastToggleTime: 0 });
  const isUserMicOnRef = useRef(false);
  const isInitializingRef = useRef(false);
  const isReconnectingRef = useRef(false);

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

  const logTutorDialogue = useCallback((role: 'user' | 'avatar', content: string, isFinal: boolean) => {
    if (!content || !content.trim()) return;
    const now = Date.now();
    const mappedRole = role === 'avatar' ? 'ai' : 'user';
    const slideSnapshot = currentSlideRef.current;
    let pending = pendingTranscriptRef.current[role];

    if (!pending) {
      pending = {
        timestamp: now,
        lastLoggedAt: 0,
        content: '',
        timeoutId: null,
      };
      pendingTranscriptRef.current[role] = pending;
    }

    pending.content = content;

    if (isFinal || now - pending.lastLoggedAt >= TRANSCRIPT_UPSERT_INTERVAL_MS) {
      upsertTutorDialogue({
        role: mappedRole,
        content,
        timestamp: pending.timestamp,
        slideId: slideSnapshot.id,
        slideTitle: slideSnapshot.title,
        mode: 'avatar',
      });
      pending.lastLoggedAt = now;
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    if (isFinal) {
      pendingTranscriptRef.current[role] = undefined;
      if (role === 'avatar') {
        avatarBufferRef.current = '';
      } else {
        userBufferRef.current = '';
      }
      return;
    }

    pending.timeoutId = setTimeout(() => {
      const current = pendingTranscriptRef.current[role];
      if (!current) return;
      upsertTutorDialogue({
        role: mappedRole,
        content: current.content,
        timestamp: current.timestamp,
        slideId: slideSnapshot.id,
        slideTitle: slideSnapshot.title,
        mode: 'avatar',
      });
      pendingTranscriptRef.current[role] = undefined;
      if (role === 'avatar') {
        avatarBufferRef.current = '';
      } else {
        userBufferRef.current = '';
      }
    }, TRANSCRIPT_IDLE_FLUSH_MS);
  }, []);

  const handleStreamEvent = useCallback((event: any) => {
    const isFinal = event.endOfSpeech === true;
    const contentChunk = event.content || '';
    const trimmed = contentChunk.trim();

    // AGGRESSIVE filter: skip any content that looks like JSON, system messages, or toggle noise
    const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[{');
    const containsJsonKeys = /"(id|title|keyPoints|systemPromptContext|state|toggleCount)"/.test(trimmed);
    const isSystemMessage = trimmed.startsWith('[SYSTEM_EVENT') ||
      trimmed.startsWith('[SILENT_CONTEXT_UPDATE') ||
      trimmed.includes('[ACKNOWLEDGED]') ||
      trimmed.includes('[DO_NOT_SPEAK]');
    const isToggleNoise = /^(on|off|camera\s*(on|off)|mic\s*(on|off)|microphone\s*(on|off))$/i.test(trimmed);

    if (isSystemMessage || looksLikeJson || containsJsonKeys || isToggleNoise) {
      return;
    }

    // Avatar (persona) speaking – show as "Tutor"
    if (event.role === MessageRole.PERSONA || event.role === 'assistant' || event.role === 'persona') {
      avatarBufferRef.current = mergeStreamingChunk(avatarBufferRef.current, contentChunk);
      const fullContent = avatarBufferRef.current.trim();
      if (fullContent) {
        addTranscriptMessage('avatar', fullContent, isFinal);
        logTutorDialogue('avatar', fullContent, isFinal);
      }
      if (isFinal) {
        avatarBufferRef.current = '';
      }
      setState(prev => ({ ...prev, isTalking: !isFinal }));
      return;
    }

    // User speech – show as "You" in transcript, but ONLY when mic is ON
    if (event.role === MessageRole.USER || event.role === 'user') {
      if (!isUserMicOnRef.current) {
        userBufferRef.current = '';
        return;
      }
      userBufferRef.current = mergeStreamingChunk(userBufferRef.current, contentChunk);
      const fullContent = userBufferRef.current.trim();
      if (fullContent) {
        addTranscriptMessage('user', fullContent, isFinal);
        logTutorDialogue('user', fullContent, isFinal);
      }
      if (isFinal) {
        userBufferRef.current = '';
      }
    }
  }, [addTranscriptMessage, logTutorDialogue]);

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
      // Check if it's a service unavailable error (API disabled)
      if (error.message?.includes('503') || error.message?.includes('Service Unavailable')) {
        throw new Error('Avatar service is currently disabled by administrator');
      }
      throw new Error('Service temporarily unavailable');
    }

    if (data?.error) {
      console.error('Anam session error:', data.error);
      throw new Error(data.error);
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
      client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, handleStreamEvent);

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

    } catch (error: any) {
      console.error('Error initializing Anam client:', error);
      
      // Parse specific error types for better user messaging
      let errorMessage = 'Service temporarily unavailable';
      const errorStr = error?.message || error?.toString() || '';
      
      if (errorStr.includes('429') || errorStr.includes('Usage limit') || errorStr.includes('upgrade your plan')) {
        errorMessage = 'Avatar usage limit reached. Please try again later or contact administrator.';
      } else if (errorStr.includes('disabled') || errorStr.includes('administrator')) {
        errorMessage = error.message;
      } else if (errorStr.includes('API key') || errorStr.includes('Unauthorized') || errorStr.includes('401')) {
        errorMessage = 'Avatar API configuration error. Contact administrator.';
      }
      
      setState(prev => ({ 
        ...prev, 
        error: errorMessage
      }));
    } finally {
      isInitializingRef.current = false;
    }
  }, [getSessionToken, handleStreamEvent, videoElementId]);

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

  // Slide change notification - RECONNECTS session to update avatar's knowledge
  // This ensures Alex ALWAYS knows the current slide context from admin's AI Tutor Context field
  const notifySlideChange = useCallback(async (slide: Slide) => {
    console.log('Slide changed to:', slide.title);
    currentSlideRef.current = slide;
    
    // If connected, reconnect to get fresh system prompt with new slide context
    // Always allow reconnection even if previous one failed
    if (clientRef.current && state.isConnected) {
      // Prevent concurrent reconnection attempts
      if (isReconnectingRef.current) {
        console.log('Already reconnecting, skipping duplicate request');
        return;
      }
      
      console.log('Reconnecting Anam session for slide context update...');
      isReconnectingRef.current = true;
      
      try {
        // Stop current stream but keep transcript
        clientRef.current.stopStreaming();
        clientRef.current = null;
        
        // Get new session token with updated slide context
        const sessionToken = await getSessionToken();
        console.log('Got new session token for slide:', slide.title);
        
        const client = createClient(sessionToken);
        
        // Re-setup event listeners
        client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
          console.log('Anam reconnected for new slide');
          setState(prev => ({ ...prev, isConnected: true }));
        });

        client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
          console.log('Anam connection closed');
          setState(prev => ({ ...prev, isConnected: false, isStreaming: false, isTalking: false }));
        });

        client.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => {
          console.log('Anam video restarted');
          setState(prev => ({ ...prev, isStreaming: true }));
        });

        // Stream events handler
        client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, handleStreamEvent);

        clientRef.current = client;
        await client.streamToVideoElement(videoElementId);
        
        // Re-apply mute state
        try {
          if (isUserMicOnRef.current) {
            client.unmuteInputAudio();
          } else {
            client.muteInputAudio();
          }
        } catch (err) {
          console.error('Error applying mic state after reconnect:', err);
        }
        
        console.log('Successfully reconnected with new slide context:', slide.title);
      } catch (error) {
        console.error('Error reconnecting for slide change:', error);
        setState(prev => ({ ...prev, error: 'Failed to update slide context' }));
      } finally {
        isReconnectingRef.current = false;
      }
    }
  }, [state.isConnected, getSessionToken, handleStreamEvent, videoElementId]);

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
    userBufferRef.current = '';
    Object.values(pendingTranscriptRef.current).forEach((pending) => {
      if (pending?.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
    });
    pendingTranscriptRef.current = {};
    toggleStatsRef.current = { cameraToggles: 0, micToggles: 0, lastToggleTime: 0 };
    isUserMicOnRef.current = false;
    isInitializingRef.current = false;
    isReconnectingRef.current = false;
  }, []);

  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  return {
    ...state,
    isReconnecting: isReconnectingRef.current,
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
