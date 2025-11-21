import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Message } from "@/types/study";
import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/utils/aiChat";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

interface TextModeProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
}

export const TextMode = ({ messages, onSendMessage, isLoading }: TextModeProps) => {
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
      
      setIsStreaming(true);
      let aiResponse = "";
      
      try {
        await streamChat({
          messages: [...messages, { role: 'user', content: userMessage, timestamp: Date.now() }],
          onDelta: (chunk) => {
            aiResponse += chunk;
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
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-card/30">
      {/* Messages area - simplified */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'ai'
                  ? 'bg-card border border-border/50'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-card border border-border/50 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compact input area */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm p-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type your response..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || isStreaming}
            className="min-h-[60px] resize-none flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isLoading || isStreaming || !input.trim()}
            title="Send"
            className="h-[60px] w-[60px]"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
