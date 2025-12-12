import { Slide } from "@/hooks/useStudySlides";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideViewerProps {
  slides: Slide[];
  currentSlide: Slide;
  onSlideChange: (slide: Slide) => void;
  className?: string;
  compact?: boolean;
}

export const SlideViewer = ({ 
  slides,
  currentSlide, 
  onSlideChange, 
  className,
  compact = false 
}: SlideViewerProps) => {
  const currentIndex = slides.findIndex(s => s.id === currentSlide.id);
  const totalSlides = slides.length;

  const goToNext = () => {
    if (currentIndex < slides.length - 1) {
      onSlideChange(slides[currentIndex + 1]);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      onSlideChange(slides[currentIndex - 1]);
    }
  };

  const goToSlide = (index: number) => {
    onSlideChange(slides[index]);
  };

  return (
    <div className={cn("flex flex-col h-full bg-gradient-to-br from-background via-background to-primary/5", className)}>
      {/* Slide Content - PowerPoint Style */}
      <div className={cn(
        "flex-1 overflow-y-auto flex items-center justify-center",
        compact ? "p-4" : "p-6 md:p-10"
      )}>
        <div className="w-full max-w-4xl mx-auto">
          {/* Slide Card */}
          <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Slide Header */}
            <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/20 px-8 py-6 border-b border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{currentIndex + 1}</span>
                </div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Slide {currentIndex + 1} of {totalSlides}
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {currentSlide.title}
              </h1>
            </div>

            {/* Slide Body */}
            <div className="p-8 md:p-10 space-y-6">
              {/* Key Points - Highlighted Box */}
              {currentSlide.keyPoints.length > 0 && (
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-6 border border-primary/20">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-primary">Key Takeaways</h3>
                  </div>
                  <ul className="grid gap-3">
                    {currentSlide.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">{i + 1}</span>
                        </div>
                        <span className="text-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Main Content Cards */}
              <div className="space-y-4">
                {renderSlideContent(currentSlide.content)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm p-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {/* Dots Navigation */}
          <div className="flex items-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  "w-3 h-3 rounded-full transition-all",
                  index === currentIndex 
                    ? "bg-primary w-8 shadow-lg shadow-primary/30" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                title={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          <Button
            variant="outline"
            onClick={goToNext}
            disabled={currentIndex === slides.length - 1}
            className="gap-2"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Helper function to render content in a more visual way
function renderSlideContent(content: string) {
  const sections: React.ReactNode[] = [];
  const lines = content.split('\n');
  let currentSection: { title?: string; items: string[]; type: 'list' | 'table' | 'text' | 'code' } | null = null;
  let inCodeBlock = false;
  let codeContent = '';
  let tableData: string[][] = [];
  let inTable = false;

  const flushSection = () => {
    if (!currentSection) return;
    
    const key = sections.length;
    
    if (currentSection.type === 'list' && currentSection.items.length > 0) {
      sections.push(
        <div key={key} className="bg-muted/30 rounded-xl p-5 border border-border/50">
          {currentSection.title && (
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full"></span>
              {currentSection.title}
            </h3>
          )}
          <ul className="space-y-2">
            {currentSection.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-muted-foreground">
                <span className="text-primary mt-1">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatText(item) }} />
              </li>
            ))}
          </ul>
        </div>
      );
    } else if (currentSection.type === 'text' && currentSection.items.length > 0) {
      sections.push(
        <div key={key} className="text-muted-foreground leading-relaxed">
          {currentSection.items.map((text, i) => (
            <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: formatText(text) }} />
          ))}
        </div>
      );
    }
    
    currentSection = null;
  };

  lines.forEach((line, idx) => {
    // Skip the main title (we show it in header)
    if (line.startsWith('# ')) return;

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        sections.push(
          <div key={`code-${idx}`} className="bg-slate-900 rounded-xl p-5 border border-border/50 overflow-x-auto">
            <pre className="text-sm text-slate-100 font-mono">{codeContent.trim()}</pre>
          </div>
        );
        codeContent = '';
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      return;
    }

    // Table detection
    if (line.startsWith('|')) {
      flushSection();
      if (!inTable) {
        inTable = true;
        tableData = [];
      }
      const cells = line.split('|').filter(c => c.trim() && !c.match(/^[-:]+$/));
      if (cells.length > 0 && !line.match(/^\|[-:\s|]+\|$/)) {
        tableData.push(cells.map(c => c.trim()));
      }
      return;
    } else if (inTable && tableData.length > 0) {
      // Render table
      sections.push(
        <div key={`table-${idx}`} className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full">
            <thead className="bg-primary/10">
              <tr>
                {tableData[0]?.map((cell, i) => (
                  <th key={i} className="text-left px-4 py-3 font-semibold text-foreground text-sm border-b border-border/50">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-muted/20">
              {tableData.slice(1).map((row, ri) => (
                <tr key={ri} className="border-b border-border/30 last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-sm text-muted-foreground">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableData = [];
      inTable = false;
    }

    // Section headers
    if (line.startsWith('## ')) {
      flushSection();
      currentSection = { title: line.replace('## ', ''), items: [], type: 'list' };
      return;
    }

    if (line.startsWith('### ')) {
      flushSection();
      currentSection = { title: line.replace('### ', ''), items: [], type: 'list' };
      return;
    }

    // List items
    if (line.startsWith('- ') || line.startsWith('✅ ') || line.startsWith('❌ ') || /^\d+\.\s/.test(line)) {
      if (!currentSection || currentSection.type !== 'list') {
        flushSection();
        currentSection = { items: [], type: 'list' };
      }
      const text = line.replace(/^[-✅❌]\s/, '').replace(/^\d+\.\s/, '');
      currentSection.items.push(line.startsWith('✅') ? `✅ ${text}` : line.startsWith('❌') ? `❌ ${text}` : text);
      return;
    }

    // Regular text
    if (line.trim()) {
      if (!currentSection || currentSection.type !== 'text') {
        flushSection();
        currentSection = { items: [], type: 'text' };
      }
      currentSection.items.push(line);
    }
  });

  flushSection();

  // Handle remaining table
  if (inTable && tableData.length > 0) {
    sections.push(
      <div key="table-final" className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full">
          <thead className="bg-primary/10">
            <tr>
              {tableData[0]?.map((cell, i) => (
                <th key={i} className="text-left px-4 py-3 font-semibold text-foreground text-sm border-b border-border/50">{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-muted/20">
            {tableData.slice(1).map((row, ri) => (
              <tr key={ri} className="border-b border-border/30 last:border-0">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-3 text-sm text-muted-foreground">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return sections;
}

function formatText(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
}
