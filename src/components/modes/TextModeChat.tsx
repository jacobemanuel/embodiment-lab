import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/utils/aiChat";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { Slide } from "@/data/slides";
import { Message } from "@/types/study";
import { appendTutorDialogue, upsertTutorDialogue } from "@/lib/tutorDialogue";

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
  const aiResponseTimestampRef = useRef<number | null>(null);
  const lastAiUpsertAtRef = useRef(0);
  const sendInFlightRef = useRef(false);
  const lastAnnouncementRef = useRef<{ key: string; at: number } | null>(null);
  const ANNOUNCEMENT_COOLDOWN_MS = 1500;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add greeting on first slide, context update on subsequent slides
  useEffect(() => {
    if (prevSlideRef.current !== currentSlide.id) {
      const isInitialLoad = prevSlideRef.current === null;
      prevSlideRef.current = currentSlide.id;
      const now = Date.now();
      const announcementKey = `${currentSlide.id}:${isInitialLoad ? 'greeting' : 'update'}`;
      if (
        lastAnnouncementRef.current &&
        lastAnnouncementRef.current.key === announcementKey &&
        now - lastAnnouncementRef.current.at < ANNOUNCEMENT_COOLDOWN_MS
      ) {
        return;
      }
      lastAnnouncementRef.current = { key: announcementKey, at: now };
      
      if (isInitialLoad && isFirstSlide) {
        // First slide greeting - like Avatar
        const greeting = `Hey there! I'm Alex, ready to help you learn about AI art! We're starting with \"${currentSlide.title}\" - feel free to ask me anything!`;
        const greetingTimestamp = Date.now();
        let shouldAppend = true;
        setMessages((prev) => {
          if (
            prev.length > 0 &&
            prev[0]?.role === 'ai' &&
            prev[0]?.content === greeting
          ) {
            shouldAppend = false;
            return prev;
          }
          return [{
            role: 'ai',
            content: greeting,
            timestamp: greetingTimestamp
          }];
        });
        if (shouldAppend) {
          appendTutorDialogue({
            role: 'ai',
            content: greeting,
            timestamp: greetingTimestamp,
            slideId: currentSlide.id,
            slideTitle: currentSlide.title,
            mode: 'text',
          });
        }
      } else if (!isInitialLoad) {
        // Subsequent slides - context continuation like Avatar
        const updateMessage = `Alright, now we're on \"${currentSlide.title}\". Need help understanding anything here?`;
        const updateTimestamp = Date.now();
        let shouldAppend = true;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'ai' && last.content === updateMessage) {
            shouldAppend = false;
            return prev;
          }
          return [...prev, {
            role: 'ai',
            content: updateMessage,
            timestamp: updateTimestamp
          }];
        });
        if (shouldAppend) {
          appendTutorDialogue({
            role: 'ai',
            content: updateMessage,
            timestamp: updateTimestamp,
            slideId: currentSlide.id,
            slideTitle: currentSlide.title,
            mode: 'text',
          });
        }
      }
    }
  }, [currentSlide, isFirstSlide]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming || sendInFlightRef.current) return;
    sendInFlightRef.current = true;

    const userMessage = input;
    setInput("");

    const slideId = currentSlide.id;
    const slideTitle = currentSlide.title;
    lastAiUpsertAtRef.current = 0;
    const userTimestamp = Date.now();
    const aiTimestampSeed = userTimestamp + 1;
    aiResponseTimestampRef.current = aiTimestampSeed;
    
    const userMsg: Message = { role: 'user', content: userMessage, timestamp: userTimestamp };
    setMessages(prev => [...prev, userMsg]);
    appendTutorDialogue({
      role: 'user',
      content: userMessage,
      timestamp: userMsg.timestamp,
      slideId,
      slideTitle,
      mode: 'text',
    });
    setIsStreaming(true);

    let aiResponse = "";

    const aiResponseTimestamp = aiResponseTimestampRef.current;
    const finishStreaming = () => {
      aiResponseTimestampRef.current = null;
      lastAiUpsertAtRef.current = 0;
      sendInFlightRef.current = false;
      setIsStreaming(false);
    };

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
          const now = Date.now();
          const aiTimestamp = aiResponseTimestampRef.current ?? now;
          aiResponseTimestampRef.current = aiTimestamp;
          setMessages(prev => {
            const idx = prev.findIndex(
              (msg) => msg.role === 'ai' && msg.timestamp === aiTimestamp
            );
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], content: aiResponse };
              return next;
            }
            return [...prev, { role: 'ai' as const, content: aiResponse, timestamp: aiTimestamp }];
          });
          if (now - lastAiUpsertAtRef.current >= 1200) {
            lastAiUpsertAtRef.current = now;
            upsertTutorDialogue({
              role: 'ai',
              content: aiResponse,
              timestamp: aiTimestamp,
              slideId,
              slideTitle,
              mode: 'text',
            });
          }
        },
        onDone: () => {
          if (aiResponse.trim()) {
            upsertTutorDialogue({
              role: 'ai',
              content: aiResponse,
              timestamp: aiResponseTimestamp ?? Date.now(),
              slideId,
              slideTitle,
              mode: 'text',
            });
          }
          finishStreaming();
        },
        onError: (error) => {
          console.error("AI error:", error);
          if (aiResponse.trim()) {
            upsertTutorDialogue({
              role: 'ai',
              content: aiResponse,
              timestamp: aiResponseTimestamp ?? Date.now(),
              slideId,
              slideTitle,
              mode: 'text',
            });
          }
          toast({ title: "Error", description: "Failed to get response", variant: "destructive" });
          finishStreaming();
        }
      });
    } catch {
      if (aiResponse.trim()) {
        upsertTutorDialogue({
          role: 'ai',
          content: aiResponse,
          timestamp: aiResponseTimestamp ?? Date.now(),
          slideId,
          slideTitle,
          mode: 'text',
        });
      }
      finishStreaming();
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
