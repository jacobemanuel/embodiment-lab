import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Slide } from "@/data/slides";
import { useAnamClient } from "@/hooks/useAnamClient";
import { TranscriptPanel, TranscriptMessage } from "@/components/TranscriptPanel";
import { cn } from "@/lib/utils";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const prevSlideRef = useRef<string>(currentSlide.id);

  const {
    isConnected,
    isStreaming,
    isTalking,
    error,
    initializeClient,
    sendMessage,
    notifySlideChange,
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

  // Notify slide changes
  useEffect(() => {
    if (prevSlideRef.current !== currentSlide.id && isConnected) {
      prevSlideRef.current = currentSlide.id;
      notifySlideChange(currentSlide);
    }
  }, [currentSlide, isConnected, notifySlideChange]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Auto-start user camera once avatar is connected (to match mockup UX)
  useEffect(() => {
    const startCamera = async () => {
      if (!isConnected || isCameraOn) return;
      try {
        console.log('Auto-starting user camera after avatar connect');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 200, height: 150, facingMode: 'user' },
          audio: false,
        });
        userStreamRef.current = stream;
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }
        setIsCameraOn(true);
        setCameraError(null);
      } catch (err) {
        console.error('Camera auto-start error:', err);
        setCameraError('Camera access denied');
        setIsCameraOn(false);
      }
    };

    void startCamera();
  }, [isConnected, isCameraOn]);

  const handleSend = () => {
    if (input.trim() && isConnected) {
      sendMessage(input);
      setInput("");
    }
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      startListening();
      setIsListening(true);
    }
  };

  const handleToggleCamera = async () => {
    if (isCameraOn) {
      // Turn off camera
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
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 200, height: 150, facingMode: 'user' },
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
      }
    }
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
          <div className="absolute bottom-3 right-3">
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
            <p className="text-xs text-center mt-1 text-muted-foreground">
              {isListening ? "Listening..." : "Muted"}
            </p>
          </div>
        )}
      </div>

      {/* User Camera Section - full width with overlay controls */}
      {isConnected && (
        <div className="border-b border-border bg-muted/30 relative" style={{ height: '140px' }}>
          {/* User video feed - full width */}
          <video
            ref={userVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "w-full h-full object-cover bg-black/80",
              !isCameraOn && "hidden"
            )}
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {/* Camera off placeholder */}
          {!isCameraOn && (
            <div className="w-full h-full flex items-center justify-center bg-muted/50">
              <VideoOff className="w-12 h-12 text-muted-foreground/50" />
            </div>
          )}

          {/* Overlay controls on camera */}
          <div className="absolute inset-0 flex items-center justify-between px-4">
            {/* Camera toggle button - left side */}
            <Button
              size="sm"
              variant={isCameraOn ? "default" : "secondary"}
              className="gap-2 shadow-lg"
              onClick={handleToggleCamera}
            >
              {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              {isCameraOn ? "Camera On" : "Enable Camera"}
            </Button>

            {/* "You" label - bottom left of video */}
            {isCameraOn && (
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                You
              </div>
            )}

            {/* Avatar can see you - right side */}
            {isCameraOn && (
              <span className="text-sm text-muted-foreground bg-background/80 px-3 py-1.5 rounded-lg shadow">
                Avatar can see you
              </span>
            )}
          </div>

          {cameraError && (
            <div className="absolute bottom-2 right-2">
              <span className="text-xs text-destructive bg-background/80 px-2 py-1 rounded">{cameraError}</span>
            </div>
          )}
        </div>
      )}

      {/* Transcript - chat bubbles style */}
      <div className="flex-1 overflow-hidden min-h-[150px]">
        <TranscriptPanel messages={transcriptMessages} isListening={isListening} />
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