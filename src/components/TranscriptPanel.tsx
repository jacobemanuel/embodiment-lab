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
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <h4 className="text-sm font-semibold text-foreground">Transcript</h4>
        {isListening && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
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
            <>
              {/* Show only final messages */}
              {messages.filter(msg => msg.isFinal !== false).map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === 'avatar' ? "justify-start" : "justify-end"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] text-sm rounded-2xl px-4 py-2 shadow-sm",
                      msg.role === 'avatar' 
                        ? "bg-primary/10 border border-primary/20 text-foreground rounded-bl-md" 
                        : "bg-secondary border border-border text-foreground rounded-br-md"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-xs font-medium",
                        msg.role === 'avatar' ? "text-primary" : "text-muted-foreground"
                      )}>
                        {msg.role === 'avatar' ? 'Tutor' : 'You'}
                      </span>
                    </div>
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              
              {/* Show typing indicator if there's a non-final message */}
              {messages.some(msg => msg.isFinal === false) && (
                <div className="flex justify-start">
                  <div className="bg-primary/10 border border-primary/20 text-foreground rounded-2xl rounded-bl-md px-4 py-2 shadow-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
