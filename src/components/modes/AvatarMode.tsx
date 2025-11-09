import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Message } from "@/types/study";
import { useState, useRef, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";

interface AvatarModeProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}

export const AvatarMode = ({ messages, onSendMessage, onSkip, isLoading }: AvatarModeProps) => {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // TODO: Generate avatar video with D-ID API when AI responds
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'ai') {
      // For now, show placeholder avatar
      // In production, call D-ID API here to generate lip-synced video
      console.log('Would generate avatar video for:', lastMessage.content);
    }
  }, [messages]);

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

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Avatar display area */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-secondary/30 to-background p-8">
        <div className="relative w-full max-w-4xl aspect-video bg-secondary/50 rounded-3xl overflow-hidden shadow-large border border-border/50">
          {/* LiveAvatar iframe */}
          <iframe 
            src="https://embed.liveavatar.com/v1/fb2090fc-4174-463b-aa9a-7117840f73d5" 
            allow="microphone" 
            title="LiveAvatar Embed" 
            className="w-full h-full"
          />
          
          {/* Engagement indicators */}
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse shadow-glow" title="Active" />
          </div>
        </div>

        {/* Latest AI message transcript */}
        {messages.length > 0 && messages[messages.length - 1].role === 'ai' && (
          <div className="mt-6 max-w-md w-full">
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {messages[messages.length - 1].content}
              </p>
            </div>
          </div>
        )}
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
          {isListening ? 'Listening...' : 'Press to respond'}
        </p>

        {/* Text fallback */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground text-center">Or type your response:</p>
          <Textarea
            placeholder="Your response (transcribed)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="min-h-[60px] resize-none"
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
              disabled={isLoading || !input.trim()}
              className="flex-1"
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
