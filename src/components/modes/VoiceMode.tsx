import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Message } from "@/types/study";
import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { streamChat } from "@/utils/aiChat";
import { useToast } from "@/hooks/use-toast";

interface VoiceModeProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}

export const VoiceMode = ({ messages, onSendMessage, onSkip, isLoading }: VoiceModeProps) => {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Speak AI messages - but only when not streaming (to avoid speaking partial messages)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'ai' && 'speechSynthesis' in window && !isStreaming) {
      // Only speak if this is a new complete message
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(lastMessage.content);
      utterance.rate = 0.9;
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }, [messages, isStreaming]);

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Please use text input.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

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
            onSendMessage(`__AI_RESPONSE__${aiResponse}`);
          },
          onDone: () => {
            setIsStreaming(false);
            
            // Speak the complete AI response
            if ('speechSynthesis' in window) {
              setIsSpeaking(true);
              const utterance = new SpeechSynthesisUtterance(aiResponse);
              utterance.rate = 0.9;
              utterance.onend = () => setIsSpeaking(false);
              window.speechSynthesis.speak(utterance);
            }
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

  return (
    <div className="flex flex-col h-full">
      {/* Waveform visualization when speaking */}
      {isSpeaking && (
        <div className="bg-primary/5 border-b border-border p-8">
          <div className="flex items-center justify-center gap-1 h-24">
            {[...Array(40)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 80 + 20}%`,
                  animationDelay: `${i * 50}ms`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 mt-4">
            <p className="text-center text-sm text-muted-foreground">AI speaking...</p>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={stopSpeaking}
              className="gap-2"
            >
              <Square className="w-3 h-3" />
              Stop
            </Button>
          </div>
        </div>
      )}

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
        {hasStarted && isLoading && (
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

      {/* Voice input area */}
      <div className="border-t border-border bg-card p-6 space-y-4">
        {/* Microphone button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={toggleListening}
            disabled={isLoading}
            className={`w-20 h-20 rounded-full ${isListening ? 'bg-destructive hover:bg-destructive/90' : ''}`}
          >
            {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          </Button>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {isListening ? 'Listening...' : 'Press to respond with voice'}
        </p>

        {/* Text fallback */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground text-center">Or type your response:</p>
          <Textarea
            placeholder="Your response (transcribed)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isStreaming}
            className="min-h-[80px] resize-none"
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
    </div>
  );
};
