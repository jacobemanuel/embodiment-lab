import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Message } from "@/types/study";
import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/utils/aiChat";
import { useToast } from "@/hooks/use-toast";

interface TextModeProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}

export const TextMode = ({ messages, onSendMessage, onSkip, isLoading }: TextModeProps) => {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (input.trim() && !isLoading && !isStreaming) {
      const userMessage = input;
      setInput("");
      onSendMessage(userMessage);
      
      // Stream AI response
      setIsStreaming(true);
      let aiResponse = "";
      
      try {
        await streamChat({
          messages: [...messages, { role: 'user', content: userMessage, timestamp: Date.now() }],
          onDelta: (chunk) => {
            aiResponse += chunk;
            // Update the last message in real-time through parent
            onSendMessage(`__AI_RESPONSE__${aiResponse}`);
          },
          onDone: () => {
            setIsStreaming(false);
          },
          onError: (error) => {
            console.error("AI error:", error);
            toast({
              title: "AI Error",
              description: "Failed to get AI response. Please try again.",
              variant: "destructive"
            });
            setIsStreaming(false);
          }
        });
      } catch (error) {
        setIsStreaming(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`space-y-2 ${msg.role === 'ai' ? '' : 'pl-12'}`}
          >
            {msg.role === 'ai' && (
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                AI Study Buddy
              </div>
            )}
            <div
              className={`rounded-2xl p-4 ${
                msg.role === 'ai'
                  ? 'bg-secondary text-foreground'
                  : 'bg-primary text-primary-foreground ml-auto max-w-[85%]'
              }`}
            >
              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              AI Study Buddy
            </div>
            <div className="bg-secondary rounded-2xl p-4">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card p-6 space-y-3">
        <Textarea
          placeholder="Type your response here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading || isStreaming}
          className="min-h-[100px] resize-none"
        />
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onSkip}
            disabled={isLoading}
            className="flex-1"
          >
            Skip
          </Button>
          <Button
            onClick={handleSend}
            disabled={isLoading || isStreaming || !input.trim()}
            className="flex-1"
          >
            {isStreaming ? "AI is typing..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
};
