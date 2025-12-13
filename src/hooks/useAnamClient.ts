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
  const processedMessagesRef = useRef<Set<string>>(new Set());

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

      // Message history - for both user and persona messages
      client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, (messages: any) => {
        console.log('Message history updated:', messages);
        if (messages && Array.isArray(messages)) {
          messages.forEach((msg: any) => {
            if (msg.role === MessageRole.PERSONA && msg.content) {
              addTranscriptMessage('avatar', msg.content, true);
            } else if (msg.role === MessageRole.USER && msg.content) {
              addTranscriptMessage('user', msg.content, true);
            }
          });
        }
      });

      // Stream events - for real-time updates (captures voice input transcription too!)
      client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (event: any) => {
        console.log('Stream event:', event);
        
        // Persona (avatar) speaking
        if (event.role === MessageRole.PERSONA && event.content) {
          const isFinal = event.endOfSpeech === undefined ? true : event.endOfSpeech;
          addTranscriptMessage('avatar', event.content, isFinal);
          setState(prev => ({ ...prev, isTalking: !isFinal }));
        }
        
        // User speaking (voice input transcription)
        if (event.role === MessageRole.USER && event.content) {
          const isFinal = event.endOfSpeech === undefined ? true : event.endOfSpeech;
          addTranscriptMessage('user', event.content, isFinal);
        }
      });

      clientRef.current = client;

      // Stream to video element
      console.log('Starting stream to video element:', videoElementId);
      await client.streamToVideoElement(videoElementId);
      console.log('Stream started successfully');

      // Check initial audio state
      const audioState = client.getInputAudioState();
      console.log('Initial audio state:', audioState);

      // IMPORTANT: microphone OFF by default – user must press the button to talk
      if (!audioState.isMuted) {
        console.log('Muting microphone by default');
        client.muteInputAudio();
        console.log('Microphone muted, state:', client.getInputAudioState());
      }

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
      // Add user message to transcript for text input
      addTranscriptMessage('user', message, true);
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

  // Push-to-talk: Start listening (enable microphone input)
  const startListening = useCallback(() => {
    if (clientRef.current && state.isConnected) {
      try {
        const beforeState = clientRef.current.getInputAudioState();
        console.log('Before unmute, audio state:', beforeState);
        
        // Enable audio input - user can now speak
        const newState = clientRef.current.unmuteInputAudio();
        console.log('Started listening - microphone enabled, new state:', newState);
      } catch (error) {
        console.error('Error starting listening:', error);
      }
    } else {
      console.warn('Cannot start listening - client not connected', { 
        hasClient: !!clientRef.current, 
        isConnected: state.isConnected 
      });
    }
  }, [state.isConnected]);

  // Push-to-talk: Stop listening (disable microphone input)
  const stopListening = useCallback(() => {
    if (clientRef.current && state.isConnected) {
      try {
        const beforeState = clientRef.current.getInputAudioState();
        console.log('Before mute, audio state:', beforeState);
        
        // Disable audio input
        const newState = clientRef.current.muteInputAudio();
        console.log('Stopped listening - microphone disabled, new state:', newState);
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
