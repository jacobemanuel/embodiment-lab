import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/utils/aiChat";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { Slide } from "@/data/slides";

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface TextModeChatProps {
  currentSlide: Slide;
}

export const TextModeChat = ({ currentSlide }: TextModeChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const prevSlideRef = useRef<string>(currentSlide.id);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add welcome message when slide changes
  useEffect(() => {
    if (prevSlideRef.current !== currentSlide.id) {
      prevSlideRef.current = currentSlide.id;
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `You're now viewing: **${currentSlide.title}**. Feel free to ask me any questions about this topic!`
      }]);
    }
  }, [currentSlide]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);

    let aiResponse = "";

    try {
      await streamChat({
        messages: [
          { role: 'system' as const, content: `You are an AI tutor teaching about AI Image Generation. Current slide: "${currentSlide.title}". ${currentSlide.systemPromptContext}. Keep answers concise and helpful.` },
          ...messages.map(m => ({ role: m.role === 'ai' ? 'assistant' as const : 'user' as const, content: m.content })),
          { role: 'user' as const, content: userMessage }
        ],
        onDelta: (chunk) => {
          aiResponse += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'ai') {
              return [...prev.slice(0, -1), { role: 'ai', content: aiResponse }];
            }
            return [...prev, { role: 'ai', content: aiResponse }];
          });
        },
        onDone: () => setIsStreaming(false),
        onError: (error) => {
          console.error("AI error:", error);
          toast({ title: "Error", description: "Failed to get response", variant: "destructive" });
          setIsStreaming(false);
        }
      });
    } catch {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border bg-card/50">
        <h3 className="font-semibold text-sm">💬 AI Tutor Chat</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Ask questions about the current slide!
          </p>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'ai' ? 'bg-muted' : 'bg-primary text-primary-foreground'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== 'ai' && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-3 py-2 flex gap-1">
              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-3 flex gap-2">
        <Textarea
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          disabled={isStreaming}
          className="min-h-[50px] resize-none flex-1 text-sm"
        />
        <Button size="icon" onClick={handleSend} disabled={isStreaming || !input.trim()} className="h-[50px] w-[50px]">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
