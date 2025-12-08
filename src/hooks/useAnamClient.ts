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
  const processedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  useEffect(() => {
    onTranscriptUpdate?.(transcriptMessages);
  }, [transcriptMessages, onTranscriptUpdate]);

  // Add transcript message with deduplication
  const addTranscriptMessage = useCallback((role: 'user' | 'avatar', content: string, isFinal: boolean = true, source: string = 'stream') => {
    // Skip empty messages
    if (!content || content.trim() === '') return;
    
    // Create a dedup key based on role and content
    const dedupKey = `${role}:${content.trim().toLowerCase()}`;
    
    setTranscriptMessages(prev => {
      // Check if we already have this exact message
      const exists = prev.some(msg => 
        msg.role === role && 
        msg.content.trim().toLowerCase() === content.trim().toLowerCase() &&
        msg.isFinal
      );
      
      if (exists && isFinal) {
        console.log('Skipping duplicate message:', dedupKey);
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
      throw new Error('Failed to get Anam session token');
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

      // Message history - only for avatar messages to avoid duplicates
      client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, (messages: any) => {
        console.log('Message history updated:', messages);
        if (messages && Array.isArray(messages)) {
          messages.forEach((msg: any) => {
            // Only add avatar messages from history, user messages come from our sendMessage
            if (msg.role === 'assistant' && msg.content) {
              addTranscriptMessage('avatar', msg.content, true, 'history');
            }
          });
        }
      });

      // Stream events - for real-time updates
      client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (event: any) => {
        console.log('Stream event:', event);
        if (event.role === 'assistant' && event.content) {
          addTranscriptMessage('avatar', event.content, event.isFinal || false, 'stream');
          setState(prev => ({ ...prev, isTalking: !event.isFinal }));
        }
        // Don't add user messages here - they're added via sendMessage
      });

      clientRef.current = client;

      // Stream to video element
      console.log('Starting stream to video element:', videoElementId);
      await client.streamToVideoElement(videoElementId);
      console.log('Stream started successfully');

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
      // Add user message to transcript (only once, here)
      addTranscriptMessage('user', message, true, 'send');
      console.log('Sending message to avatar:', message);
      await clientRef.current.talk(message);
      console.log('Message sent successfully');
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
        // Short notification about slide change in English
        const message = `We moved to: "${slide.title}". Key points: ${slide.keyPoints.slice(0, 2).join(', ')}. Any questions?`;
        console.log('Notifying slide change:', message);
        await clientRef.current.talk(message);
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
    processedMessagesRef.current.clear();
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
