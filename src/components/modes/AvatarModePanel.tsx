import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { Slide } from "@/data/slides";
import { useAnamClient } from "@/hooks/useAnamClient";
import { TranscriptPanel, TranscriptMessage } from "@/components/TranscriptPanel";

interface AvatarModePanelProps {
  currentSlide: Slide;
  onSlideChange: (slide: Slide) => void;
}

export const AvatarModePanel = ({ currentSlide, onSlideChange }: AvatarModePanelProps) => {
  const [input, setInput] = useState("");
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);
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

  return (
    <div className="flex flex-col h-full">
      {/* Avatar Video */}
      <div className="relative aspect-video bg-gradient-to-br from-card to-muted border-b border-border">
        <video
          id="anam-video"
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Status overlay */}
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            {error ? (
              <div className="text-center p-4">
                <p className="text-destructive text-sm mb-2">{error}</p>
                <Button size="sm" onClick={initializeClient}>Retry</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Connecting...</span>
              </div>
            )}
          </div>
        )}

        {/* Speaking indicator */}
        {isTalking && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded-full text-xs">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Speaking...
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-hidden">
        <TranscriptPanel messages={transcriptMessages} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex gap-2">
        <Textarea
          placeholder={isConnected ? "Type or speak..." : "Connecting..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          disabled={!isConnected}
          className="min-h-[50px] resize-none flex-1 text-sm"
        />
        <Button size="icon" onClick={handleSend} disabled={!isConnected || !input.trim()} className="h-[50px] w-[50px]">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
