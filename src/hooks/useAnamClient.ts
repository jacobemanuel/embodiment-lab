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

  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  useEffect(() => {
    onTranscriptUpdate?.(transcriptMessages);
  }, [transcriptMessages, onTranscriptUpdate]);

  // Add transcript message with deduplication and filtering
  const addTranscriptMessage = useCallback((role: 'user' | 'avatar', content: string, isFinal: boolean = true) => {
    // Skip empty or very short meaningless messages
    if (!content || content.trim().length < 2) return;
    
    // Filter out noise/garbage transcriptions (random words, filler sounds)
    const trimmed = content.trim().toLowerCase();
    const noisePatterns = ['uh', 'um', 'ah', 'hmm', 'hm', 'okay', 'ok', 'like', 'so', 'and', 'the', 'a', 'is'];
    if (trimmed.length < 4 && noisePatterns.includes(trimmed)) return;
    
    setTranscriptMessages(prev => {
      // Check if we already have this exact final message
      const exists = prev.some(msg => 
        msg.role === role && 
        msg.content.trim().toLowerCase() === content.trim().toLowerCase() &&
        msg.isFinal
      );
      
      if (exists && isFinal) {
        return prev;
      }
      
      const lastMessage = prev[prev.length - 1];
      
      // Update existing non-final message from same role
      if (lastMessage && lastMessage.role === role && !lastMessage.isFinal) {
        return [...prev.slice(0, -1), { ...lastMessage, content, isFinal }];
      }
      
      // Add new message
      return [...prev, {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role,
        content,
        timestamp: Date.now(),
        isFinal
      }];
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

      // Start with microphone muted by default (push-to-talk UX)
      try {
        client.muteInputAudio();
        console.log('Anam input audio muted by default');
      } catch (e) {
        console.warn('Could not mute Anam input audio on init:', e);
      }

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

  // Push-to-talk: control Anam microphone directly
  const startListening = useCallback(() => {
    if (!clientRef.current) return;
    try {
      const state = clientRef.current.unmuteInputAudio();
      console.log('startListening – unmuted Anam mic, state:', state);
    } catch (e) {
      console.error('Error unmuting Anam mic:', e);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!clientRef.current) return;
    try {
      const state = clientRef.current.muteInputAudio();
      console.log('stopListening – muted Anam mic, state:', state);
    } catch (e) {
      console.error('Error muting Anam mic:', e);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      try {
        clientRef.current.muteInputAudio();
      } catch (e) {
        console.warn('Error muting Anam mic on disconnect:', e);
      }
      clientRef.current.stopStreaming();
      clientRef.current = null;
    }
    setState({ isConnected: false, isStreaming: false, isTalking: false, error: null });
    processedMessagesRef.current = {};
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
    startListening,
    stopListening,
    disconnect,
  };
};
