import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StudyMode } from "@/types/study";
import { slides, Slide } from "@/data/slides";
import { SlideViewer } from "@/components/SlideViewer";
import { ImagePlayground } from "@/components/ImagePlayground";
import logo from "@/assets/logo-white.png";
import { Button } from "@/components/ui/button";
import { LogOut, Sparkles, ChevronLeft, ChevronRight, MessageSquare, Video } from "lucide-react";
import { TextModeChat } from "@/components/modes/TextModeChat";
import { AvatarModePanel } from "@/components/modes/AvatarModePanel";

const Learning = () => {
  const { mode } = useParams<{ mode: StudyMode }>();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState<Slide>(slides[0]);
  const [isPlaygroundVisible, setIsPlaygroundVisible] = useState(false);
  const [shouldPulseButton, setShouldPulseButton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isPlaygroundVisible) setShouldPulseButton(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isPlaygroundVisible]);

  const handleSlideChange = (slide: Slide) => {
    setCurrentSlide(slide);
  };

  const handleModeSwitch = (newMode: StudyMode) => {
    navigate(`/learning/${newMode}`, { replace: true });
  };

  const isTextMode = mode === 'text';

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
                <><Video className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Avatar Mode</span></>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/mode-assignment')} className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Change Mode</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/post-test')} className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Finish</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* Slide Viewer - Center */}
        <div className={`${isPlaygroundVisible ? 'md:w-1/2' : 'md:w-2/3'} w-full transition-all duration-300 border-r border-border`}>
          <SlideViewer 
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
            <AvatarModePanel currentSlide={currentSlide} onSlideChange={handleSlideChange} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Learning;
