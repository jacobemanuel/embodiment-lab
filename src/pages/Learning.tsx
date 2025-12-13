import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StudyMode } from "@/types/study";
import { useStudySlides, Slide } from "@/hooks/useStudySlides";
import { SlideViewer } from "@/components/SlideViewer";
import { ImagePlayground } from "@/components/ImagePlayground";
import logo from "@/assets/logo-white.png";
import { Button } from "@/components/ui/button";
import { LogOut, Sparkles, ChevronLeft, ChevronRight, MessageSquare, Smile, Loader2 } from "lucide-react";
import { TextModeChat } from "@/components/modes/TextModeChat";
import { AvatarModePanel } from "@/components/modes/AvatarModePanel";
import { cn } from "@/lib/utils";
import { useStudyFlowGuard } from "@/hooks/useStudyFlowGuard";
import ExitStudyButton from "@/components/ExitStudyButton";

const Learning = () => {
  const { mode } = useParams<{ mode: StudyMode }>();
  const navigate = useNavigate();
  
  // Guard: Ensure user completed pre-test and selected a mode
  useStudyFlowGuard('learning');
  
  const { slides, isLoading, error } = useStudySlides();
  const [currentSlide, setCurrentSlide] = useState<Slide | null>(null);
  const [isPlaygroundVisible, setIsPlaygroundVisible] = useState(false);
  const [shouldPulseButton, setShouldPulseButton] = useState(false);
  const [showFinishProminent, setShowFinishProminent] = useState(false);

  // Set initial slide when slides are loaded
  useEffect(() => {
    if (slides.length > 0 && !currentSlide) {
      setCurrentSlide(slides[0]);
    }
  }, [slides, currentSlide]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isPlaygroundVisible) setShouldPulseButton(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isPlaygroundVisible]);

  // Make Finish button prominent after 60 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFinishProminent(true);
    }, 60000); // 60 seconds
    return () => clearTimeout(timer);
  }, []);

  const handleSlideChange = (slide: Slide) => {
    setCurrentSlide(slide);
  };

  const isTextMode = mode === 'text';

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading learning content...</p>
        </div>
      </div>
    );
  }

  if (error || slides.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load learning content</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!currentSlide) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <img src={logo} alt="Logo" className="h-7" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-3 py-1.5">
              {isTextMode ? (
                <><MessageSquare className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Text Mode</span></>
              ) : (
                <><Smile className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Avatar Mode</span></>
              )}
            </div>
            {/* Mode is locked - no switching allowed */}
            <Button 
              variant={showFinishProminent ? "default" : "outline"} 
              size="sm" 
              onClick={() => navigate('/post-test')} 
              className={cn(
                "gap-2 transition-all",
                showFinishProminent && "bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/50 animate-pulse"
              )}
            >
              <ChevronRight className="w-4 h-4" />
              <span className={showFinishProminent ? "inline" : "hidden sm:inline"}>Finish</span>
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <ExitStudyButton showLabel={false} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* Slide Viewer - Center */}
        <div className={`${isPlaygroundVisible ? 'md:w-1/2' : 'md:w-2/3'} w-full transition-all duration-300 border-r border-border`}>
          <SlideViewer 
            slides={slides}
            currentSlide={currentSlide} 
            onSlideChange={handleSlideChange}
          />
        </div>

        {/* Chat/Avatar Panel - Right side (hidden on mobile when playground visible) */}
        <div className={`hidden md:flex ${isPlaygroundVisible ? 'md:w-1/4' : 'md:w-1/3'} flex-col border-r border-border`}>
          {isTextMode ? (
            <TextModeChat currentSlide={currentSlide} />
          ) : (
            <AvatarModePanel currentSlide={currentSlide} onSlideChange={handleSlideChange} />
          )}
        </div>

        {/* AI Playground */}
        {isPlaygroundVisible && (
          <div className="hidden md:block md:w-1/4 overflow-auto bg-gradient-to-br from-card/50 to-background/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <h3 className="font-semibold">AI Playground</h3>
            </div>
            <ImagePlayground isOpen={true} onClose={() => {}} embedded={true} />
          </div>
        )}

        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-l-lg rounded-r-none bg-card/90 border border-r-0 border-border h-16 w-10 ${
            shouldPulseButton && !isPlaygroundVisible ? 'animate-attention-pulse border-primary/70' : ''
          } ${isPlaygroundVisible ? 'md:block hidden' : 'hidden md:block'}`}
          onClick={() => { setIsPlaygroundVisible(!isPlaygroundVisible); setShouldPulseButton(false); }}
        >
          {isPlaygroundVisible ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>

        {/* Mobile Chat Panel - Bottom sheet style */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-1/2 bg-card border-t border-border z-40">
          {isTextMode ? (
            <TextModeChat currentSlide={currentSlide} />
          ) : (
            // To avoid creating TWO Anam clients at once, we only mount
            // AvatarModePanel on desktop. On mobile we show an info message.
            <div className="h-full flex items-center justify-center px-4 text-sm text-muted-foreground text-center">
              Avatar Mode is currently available on larger screens. Please use a desktop or tablet for the full avatar experience.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Learning;
