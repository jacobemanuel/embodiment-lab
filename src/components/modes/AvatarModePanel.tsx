import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Mic, MicOff } from "lucide-react";
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
  const videoRef = useRef<HTMLVideoElement>(null);
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

  return (
    <div className="flex flex-col h-full">
      {/* Avatar Video - BIGGER */}
      <div className="relative bg-gradient-to-br from-card to-muted border-b border-border" style={{ minHeight: '320px' }}>
        <video
          id="anam-video"
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ minHeight: '320px' }}
        />
        
        {/* Status overlay */}
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            {error ? (
              <div className="text-center p-4">
                <p className="text-destructive text-sm mb-2">{error}</p>
                <Button size="sm" onClick={initializeClient}>Spróbuj ponownie</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Łączenie z avatarem...</span>
              </div>
            )}
          </div>
        )}

        {/* Speaking indicator */}
        {isTalking && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Mówię...
          </div>
        )}

        {/* Push-to-talk button - prominent position */}
        {isConnected && (
          <div className="absolute bottom-3 right-3">
            <Button
              size="lg"
              variant={isListening ? "destructive" : "default"}
              className={cn(
                "rounded-full w-14 h-14 shadow-lg transition-all",
                isListening && "animate-pulse ring-4 ring-destructive/30"
              )}
              onClick={handleToggleListening}
            >
              {isListening ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Transcript - chat bubbles style */}
      <div className="flex-1 overflow-hidden min-h-[180px]">
        <TranscriptPanel messages={transcriptMessages} isListening={isListening} />
      </div>

      {/* Text Input - alternative to voice */}
      <div className="border-t border-border p-3 flex gap-2 bg-muted/20">
        <Textarea
          placeholder={isConnected ? "Lub wpisz wiadomość..." : "Łączenie..."}
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
