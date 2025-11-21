import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Message } from "@/types/study";
import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, SkipForward } from "lucide-react";
import { AvatarPlaceholder } from "@/components/AvatarPlaceholder";

interface AvatarModeProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}

export const AvatarMode = ({ messages, onSendMessage, onSkip, isLoading }: AvatarModeProps) => {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleListening = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in your browser. Please use text input.");
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
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput("");
    }
  };

  const lastAiMessage = [...messages].reverse().find(m => m.role === 'ai')?.content;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-card/30">
      {/* Simplified avatar display */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl space-y-4">
          {/* Avatar container - compact */}
          <div className="relative aspect-video bg-card rounded-2xl overflow-hidden border border-border shadow-lg">
            <AvatarPlaceholder />
            <div className="absolute top-3 right-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-ai-glow" />
            </div>
          </div>

          {/* Current message bubble */}
          {lastAiMessage && (
            <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50">
              <p className="text-sm leading-relaxed text-center">{lastAiMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Compact input area */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm p-4">
        <div className="flex gap-2 items-end">
          {/* Voice button */}
          <Button
            size="icon"
            variant={isListening ? "destructive" : "outline"}
            onClick={toggleListening}
            disabled={isLoading}
            className="h-[60px] w-[60px]"
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          {/* Text input */}
          <Textarea
            placeholder={isListening ? "Listening..." : "Type or speak your response..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="min-h-[60px] resize-none flex-1"
          />

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={onSkip}
              disabled={isLoading}
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
