import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface TranscriptMessage {
  id: string;
  role: 'user' | 'avatar';
  content: string;
  timestamp: number;
  isFinal?: boolean;
}

interface TranscriptPanelProps {
  messages: TranscriptMessage[];
  className?: string;
  isListening?: boolean;
}

export const TranscriptPanel = ({ 
  messages, 
  className,
  isListening = false 
}: TranscriptPanelProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h4 className="text-sm font-semibold text-foreground">Transcript</h4>
        {isListening && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            Listening...
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Conversation transcript will appear here...
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "text-sm rounded-lg px-3 py-2",
                  msg.role === 'avatar' 
                    ? "bg-primary/10 border border-primary/20 text-foreground" 
                    : "bg-muted/50 border border-border text-muted-foreground ml-4"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "text-xs font-semibold",
                    msg.role === 'avatar' ? "text-primary" : "text-muted-foreground"
                  )}>
                    {msg.role === 'avatar' ? '🤖 Tutor' : '👤 You'}
                  </span>
                  {!msg.isFinal && (
                    <span className="text-xs text-muted-foreground/50 italic">
                      (typing...)
                    </span>
                  )}
                </div>
                <p className="leading-relaxed">{msg.content}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
