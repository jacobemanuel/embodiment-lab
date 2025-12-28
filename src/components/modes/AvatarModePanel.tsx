import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Slide } from "@/data/slides";
import { useAnamClient } from "@/hooks/useAnamClient";
import { TranscriptPanel, TranscriptMessage } from "@/components/TranscriptPanel";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { appendTimingEntry } from "@/lib/sessionTelemetry";

interface AvatarModePanelProps {
  currentSlide: Slide;
  onSlideChange: (slide: Slide) => void;
}

export const AvatarModePanel = ({ currentSlide, onSlideChange }: AvatarModePanelProps) => {
  const [input, setInput] = useState("");
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(true);
  const [isFirstSlide, setIsFirstSlide] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const prevSlideRef = useRef<Slide>(currentSlide);
  const hasAutoStartedCameraRef = useRef(false);
  const slideStartTimeRef = useRef<Date>(new Date());
  const sessionIdRef = useRef<string | null>(null);
  const cameraHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const firstSlideIdRef = useRef<string>(currentSlide.id);
  const slideExitSavedRef = useRef(false);

  // Get session ID from sessionStorage
  useEffect(() => {
    sessionIdRef.current = sessionStorage.getItem('sessionId');
  }, []);

  const {
    isConnected,
    isStreaming,
    isTalking,
    error,
    initializeClient,
    sendMessage,
    notifySlideChange,
    notifyCameraToggle,
    notifyMicToggle,
    startListening,
    stopListening,
  } = useAnamClient({
    currentSlide,
    videoElementId: 'anam-video',
    onTranscriptUpdate: setTranscriptMessages,
  });

  // Initialize on mount
  useEffect(() => {
    initializeClient();
  }, [initializeClient]);

  // Save time tracking when slide changes
  const saveSlideTime = async (slideId: string, slideTitle: string, startTime: Date) => {
    if (!sessionIdRef.current) return;
    
    const endTime = new Date();
    const durationSeconds = Math.min(
      Math.round((endTime.getTime() - startTime.getTime()) / 1000),
      180
    );
    
    // Only save if duration > 2 seconds (filter out quick navigation)
    if (durationSeconds < 2) return;
    appendTimingEntry({
      kind: 'slide',
      slideId,
      slideTitle,
      durationSeconds,
      mode: 'avatar',
      startedAt: startTime.toISOString(),
      endedAt: endTime.toISOString(),
    });
    
    try {
      await supabase.functions.invoke('save-avatar-time', {
        body: {
          sessionId: sessionIdRef.current,
          slideId,
          slideTitle,
          startedAt: startTime.toISOString(),
          endedAt: endTime.toISOString(),
          durationSeconds,
          mode: 'avatar',
        }
      });
      console.log(`Avatar time saved: ${slideTitle} - ${durationSeconds}s`);
    } catch (err) {
      console.error('Failed to save avatar time:', err);
    }
  };

  // Notify slide changes and track time
  useEffect(() => {
    if (prevSlideRef.current.id !== currentSlide.id) {
      // Save time for previous slide before switching
      const prevSlide = prevSlideRef.current;
      saveSlideTime(prevSlide.id, prevSlide.title, slideStartTimeRef.current);

      // Reset timer for new slide
      slideStartTimeRef.current = new Date();
      prevSlideRef.current = currentSlide;
      slideExitSavedRef.current = false;
      if (isConnected) {
        notifySlideChange(currentSlide);
      }

      // After first slide, hide camera immediately on subsequent slides
      if (currentSlide.id !== firstSlideIdRef.current) {
        setIsFirstSlide(false);
        setShowCamera(false);
      }
    }
  }, [currentSlide, isConnected, notifySlideChange]);

  const flushAvatarSlideTime = () => {
    if (!sessionIdRef.current || !currentSlide || slideExitSavedRef.current) return;
    slideExitSavedRef.current = true;
    saveSlideTime(currentSlide.id, currentSlide.title, slideStartTimeRef.current);
  };

  useEffect(() => {
    const handlePageHide = () => {
      flushAvatarSlideTime();
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [currentSlide]);

  // Hide camera after 45 seconds on first slide only
  useEffect(() => {
    if (isFirstSlide && isCameraOn) {
      cameraHideTimerRef.current = setTimeout(() => {
        setShowCamera(false);
      }, 45000); // 45 seconds
      
      return () => {
        if (cameraHideTimerRef.current) {
          clearTimeout(cameraHideTimerRef.current);
        }
      };
    }
  }, [isFirstSlide, isCameraOn]);

  // Cleanup camera on unmount AND save final slide time
  useEffect(() => {
    return () => {
      // Clear camera hide timer
      if (cameraHideTimerRef.current) {
        clearTimeout(cameraHideTimerRef.current);
      }
      
      // Save time for current slide when leaving avatar mode
      flushAvatarSlideTime();
      
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentSlide]);

  // Auto-start user camera once avatar is connected (to match mockup UX)
  // ALSO: Re-attach existing stream to video element after slide changes / reconnects
  // The key is to NOT stop the stream when slides change - keep it running
  useEffect(() => {
    const startOrReattachCamera = async () => {
      // Always try to re-attach if stream exists and video element is available
      if (userStreamRef.current && userVideoRef.current && isCameraOn) {
        // Check if stream is still active
        const tracks = userStreamRef.current.getVideoTracks();
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          console.log('Re-attaching existing camera stream to video element');
          userVideoRef.current.srcObject = userStreamRef.current;
          return;
        } else {
          // Stream died, restart it
          console.log('Camera stream died, restarting...');
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: 640, height: 480, facingMode: 'user' },
              audio: false,
            });
            userStreamRef.current = stream;
            if (userVideoRef.current) {
              userVideoRef.current.srcObject = stream;
            }
            setCameraError(null);
          } catch (err) {
            console.error('Camera restart error:', err);
            setCameraError('Camera access denied');
            setIsCameraOn(false);
          }
          return;
        }
      }
      
      if (!isConnected) return;
      
      // First time auto-start
      if (!hasAutoStartedCameraRef.current) {
        try {
          console.log('Auto-starting user camera after avatar connect');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false,
          });
          userStreamRef.current = stream;
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream;
          }
          setIsCameraOn(true);
          setCameraError(null);
          hasAutoStartedCameraRef.current = true;
        } catch (err) {
          console.error('Camera auto-start error:', err);
          setCameraError('Camera access denied');
          setIsCameraOn(false);
        }
      }
    };

    void startOrReattachCamera();
  }, [isConnected, isCameraOn, currentSlide.id]);
  
  // Periodically check if camera stream is still attached (handles slide change disconnects)
  useEffect(() => {
    if (!isCameraOn || !userStreamRef.current) return;
    
    const checkInterval = setInterval(() => {
      if (userVideoRef.current && userStreamRef.current) {
        const tracks = userStreamRef.current.getVideoTracks();
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          // Stream is alive, make sure it's attached
          if (userVideoRef.current.srcObject !== userStreamRef.current) {
            console.log('Re-attaching camera stream (detected detachment)');
            userVideoRef.current.srcObject = userStreamRef.current;
          }
        }
      }
    }, 500);
    
    return () => clearInterval(checkInterval);
  }, [isCameraOn]);

  const handleSend = () => {
    if (input.trim() && isConnected) {
      sendMessage(input);
      setInput("");
    }
  };

  const handleToggleListening = () => {
    const newState = !isListening;
    if (newState) {
      startListening();
    } else {
      stopListening();
    }
    setIsListening(newState);
    // Notify avatar about mic toggle
    notifyMicToggle(newState);
  };

  const handleToggleCamera = async () => {
    console.log('Toggle camera clicked, current state:', isCameraOn);
    const newCameraState = !isCameraOn;
    
    if (isCameraOn) {
      // Turn off camera
      console.log('Turning camera OFF');
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
        userStreamRef.current = null;
      }
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = null;
      }
      setIsCameraOn(false);
      setCameraError(null);
    } else {
      // Turn on camera
      console.log('Turning camera ON');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false
        });
        userStreamRef.current = stream;
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }
        setIsCameraOn(true);
        setCameraError(null);
      } catch (err) {
        console.error('Camera access error:', err);
        setCameraError('Camera access denied');
        setIsCameraOn(false);
        return; // Don't notify if camera failed
      }
    }
    
    // Notify avatar about camera toggle
    notifyCameraToggle(newCameraState);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Avatar Video - BIGGER */}
      <div className="relative bg-gradient-to-br from-card to-muted border-b border-border" style={{ minHeight: '280px' }}>
        <video
          id="anam-video"
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ minHeight: '280px' }}
        />
        
        {/* Status overlay */}
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            {error ? (
              <div className="text-center p-4">
                <p className="text-destructive text-sm mb-2">{error}</p>
                <Button size="sm" onClick={initializeClient}>Try again</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Connecting to avatar...</span>
              </div>
            )}
          </div>
        )}

        {/* Speaking indicator */}
        {isTalking && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Speaking...
          </div>
        )}

        {/* Push-to-talk button */}
        {isConnected && (
          <div className="absolute bottom-3 right-3 flex flex-col items-center">
            <Button
              size="lg"
              variant="outline"
              className={cn(
                "rounded-full w-14 h-14 shadow-lg transition-all border-2",
                isListening 
                  ? "bg-primary text-primary-foreground border-primary ring-4 ring-primary/30" 
                  : "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90"
              )}
              onClick={handleToggleListening}
              title={isListening ? "Click to mute" : "Click to speak"}
            >
              {isListening ? (
                <Mic className="w-6 h-6 animate-pulse" />
              ) : (
                <MicOff className="w-6 h-6" />
              )}
            </Button>
            <p className="text-xs text-center mt-1 text-muted-foreground w-32">
              {isListening ? "Listening mode" : "Tap to talk"}
            </p>
          </div>
        )}
      </div>

      {isConnected && showCamera && (
        <div className="border-b border-border bg-card/80">
          <div className="flex items-center justify-start px-4 py-3 gap-4">
            {/* Left side: controls and labels */}
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant={isCameraOn ? "default" : "secondary"}
                className="gap-2 shadow-lg"
                onClick={handleToggleCamera}
              >
                {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                {isCameraOn ? "Camera On" : "Enable Camera"}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                {isCameraOn ? "Alex can see you" : "Alex cannot see you"}
              </p>
              {cameraError && (
                <p className="text-[11px] text-destructive max-w-xs mt-1">{cameraError}</p>
              )}
            </div>

            {/* Right side: user camera preview */}
            <div className="relative h-28 w-40 sm:h-32 sm:w-48 rounded-xl overflow-hidden bg-muted border border-border/50 flex items-center justify-center shadow-md">
              <video
                ref={userVideoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "w-full h-full object-cover",
                  !isCameraOn && "hidden"
                )}
                style={{ transform: 'scaleX(-1)' }}
              />

              {!isCameraOn && (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground/60">
                  <VideoOff className="w-8 h-8" />
                </div>
              )}

              {isCameraOn && (
                <div className="absolute bottom-1 left-1 bg-background/80 text-foreground text-[10px] px-1.5 py-0.5 rounded">
                  You
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transcript - chat bubbles style - expands when camera is hidden */}
      <div className={`flex-1 overflow-hidden ${showCamera ? 'min-h-[150px]' : 'min-h-[250px]'}`}>
        <TranscriptPanel messages={transcriptMessages} isListening={isListening} isSpeaking={isTalking} />
      </div>

      {/* Text Input - alternative to voice */}
      <div className="border-t border-border p-3 flex gap-2 bg-muted/20">
        <Textarea
          placeholder={isConnected ? "Or type a message..." : "Connecting..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          disabled={!isConnected}
          className="min-h-[50px] max-h-[80px] resize-none flex-1 text-sm"
        />
        <Button 
          size="icon" 
          onClick={handleSend} 
          disabled={!isConnected || !input.trim()} 
          className="h-[50px] w-[50px]"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
