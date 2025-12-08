import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient, AnamEvent } from '@anam-ai/js-sdk';
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

  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  useEffect(() => {
    onTranscriptUpdate?.(transcriptMessages);
  }, [transcriptMessages, onTranscriptUpdate]);

  const addTranscriptMessage = useCallback((role: 'user' | 'avatar', content: string, isFinal: boolean = true) => {
    setTranscriptMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === role && !lastMessage.isFinal) {
        return [...prev.slice(0, -1), { ...lastMessage, content, isFinal }];
      }
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
      throw new Error('Failed to get Anam session token');
    }

    return data.sessionToken;
  }, []);

  const initializeClient = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const sessionToken = await getSessionToken();
      const client = createClient(sessionToken);

      // Set up event listeners
      client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
        console.log('Anam connection established');
        setState(prev => ({ ...prev, isConnected: true }));
      });

      client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
        console.log('Anam connection closed');
        setState(prev => ({ ...prev, isConnected: false, isStreaming: false }));
      });

      client.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => {
        console.log('Anam video started');
        setState(prev => ({ ...prev, isStreaming: true }));
      });

      client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, (messages: any) => {
        console.log('Message history updated:', messages);
        if (messages && Array.isArray(messages)) {
          messages.forEach((msg: any) => {
            if (msg.role === 'assistant') {
              addTranscriptMessage('avatar', msg.content, true);
            } else if (msg.role === 'user') {
              addTranscriptMessage('user', msg.content, true);
            }
          });
        }
      });

      client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (event: any) => {
        console.log('Stream event:', event);
        if (event.role === 'assistant') {
          addTranscriptMessage('avatar', event.content, event.isFinal || false);
          setState(prev => ({ ...prev, isTalking: !event.isFinal }));
        } else if (event.role === 'user') {
          addTranscriptMessage('user', event.content, event.isFinal || true);
        }
      });

      clientRef.current = client;

      // Stream to video element
      await client.streamToVideoElement(videoElementId);

    } catch (error) {
      console.error('Error initializing Anam client:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to connect to avatar'
      }));
    }
  }, [getSessionToken, addTranscriptMessage, videoElementId]);

  const sendMessage = useCallback(async (message: string) => {
    if (!clientRef.current || !state.isConnected) {
      console.error('Cannot send message: client not connected');
      return;
    }

    try {
      addTranscriptMessage('user', message, true);
      await clientRef.current.talk(message);
    } catch (error) {
      console.error('Error sending message:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to send message'
      }));
    }
  }, [state.isConnected, addTranscriptMessage]);

  const notifySlideChange = useCallback(async (slide: Slide) => {
    if (clientRef.current && state.isConnected) {
      try {
        // Short notification about slide change
        await clientRef.current.talk(
          `Przeszliśmy do: "${slide.title}". Główne punkty: ${slide.keyPoints.slice(0, 2).join(', ')}. Masz pytania?`
        );
      } catch (error) {
        console.error('Error notifying slide change:', error);
      }
    }
  }, [state.isConnected]);

  // Push-to-talk: Start listening (enable microphone input)
  const startListening = useCallback(() => {
    if (clientRef.current && state.isConnected) {
      try {
        // Enable audio input - user can now speak
        clientRef.current.unmuteInputAudio();
        console.log('Started listening - microphone enabled');
      } catch (error) {
        console.error('Error starting listening:', error);
      }
    }
  }, [state.isConnected]);

  // Push-to-talk: Stop listening (disable microphone input)
  const stopListening = useCallback(() => {
    if (clientRef.current && state.isConnected) {
      try {
        // Disable audio input
        clientRef.current.muteInputAudio();
        console.log('Stopped listening - microphone disabled');
      } catch (error) {
        console.error('Error stopping listening:', error);
      }
    }
  }, [state.isConnected]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stopStreaming();
      clientRef.current = null;
    }
    setState({ isConnected: false, isStreaming: false, isTalking: false, error: null });
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
