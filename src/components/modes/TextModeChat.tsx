import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/utils/aiChat";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { Slide } from "@/data/slides";
import { Message } from "@/types/study";
import { appendTutorDialogue } from "@/lib/tutorDialogue";

interface TextModeChatProps {
  currentSlide: Slide;
}

export const TextModeChat = ({ currentSlide }: TextModeChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const prevSlideRef = useRef<string | null>(null);
  const isFirstSlide = currentSlide.id === 'intro' || currentSlide.id === 'slide-1';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add greeting on first slide, context update on subsequent slides
  useEffect(() => {
    if (prevSlideRef.current !== currentSlide.id) {
      const isInitialLoad = prevSlideRef.current === null;
      prevSlideRef.current = currentSlide.id;
      
      if (isInitialLoad && isFirstSlide) {
        // First slide greeting - like Avatar
        const greeting = `Hey! Nice to see you! 👋 I'm Alex, your AI tutor for learning about AI image generation. We're starting with \"${currentSlide.title}\" - feel free to ask me anything!`;
        setMessages([{
          role: 'ai',
          content: greeting,
          timestamp: Date.now()
        }]);
        appendTutorDialogue({
          role: 'ai',
          content: greeting,
          timestamp: Date.now(),
          slideId: currentSlide.id,
          slideTitle: currentSlide.title,
          mode: 'text',
        });
      } else if (!isInitialLoad) {
        // Subsequent slides - context continuation like Avatar
        const updateMessage = `Alright, now we're on \"${currentSlide.title}\". Need help understanding anything here?`;
        setMessages(prev => [...prev, {
          role: 'ai',
          content: updateMessage,
          timestamp: Date.now()
        }]);
        appendTutorDialogue({
          role: 'ai',
          content: updateMessage,
          timestamp: Date.now(),
          slideId: currentSlide.id,
          slideTitle: currentSlide.title,
          mode: 'text',
        });
      }
    }
  }, [currentSlide, isFirstSlide]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input;
    setInput("");
    
    const userMsg: Message = { role: 'user', content: userMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    appendTutorDialogue({
      role: 'user',
      content: userMessage,
      timestamp: userMsg.timestamp,
      slideId: currentSlide.id,
      slideTitle: currentSlide.title,
      mode: 'text',
    });
    setIsStreaming(true);

    let aiResponse = "";

    // Build message history for the AI - include slide context with priority like Avatar mode
    const systemContext: Message = {
      role: 'ai',
      content: `[PRIORITY #1 - CURRENT SLIDE CONTEXT]
You are currently teaching slide: "${currentSlide.title}"
Slide content context: ${currentSlide.systemPromptContext}
Key points to cover: ${currentSlide.keyPoints?.join(', ') || 'See slide content'}

IMPORTANT: Focus your responses on this specific slide topic. If the user asks what slide they're on, tell them "${currentSlide.title}".`,
      timestamp: Date.now() - 1
    };

    try {
      await streamChat({
        messages: [systemContext, ...messages, userMsg],
        onDelta: (chunk) => {
          aiResponse += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'ai' && last.timestamp > userMsg.timestamp) {
              return [...prev.slice(0, -1), { role: 'ai' as const, content: aiResponse, timestamp: last.timestamp }];
            }
            return [...prev, { role: 'ai' as const, content: aiResponse, timestamp: Date.now() }];
          });
        },
        onDone: () => {
          if (aiResponse.trim()) {
            appendTutorDialogue({
              role: 'ai',
              content: aiResponse,
              timestamp: Date.now(),
              slideId: currentSlide.id,
              slideTitle: currentSlide.title,
              mode: 'text',
            });
          }
          setIsStreaming(false);
        },
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
