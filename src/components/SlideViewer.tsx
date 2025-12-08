import { Slide, slides } from "@/data/slides";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideViewerProps {
  currentSlide: Slide;
  onSlideChange: (slide: Slide) => void;
  className?: string;
  compact?: boolean;
}

export const SlideViewer = ({ 
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

  // Parse markdown content (simple parser)
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent = '';
    let inTable = false;
    let tableRows: string[][] = [];

    lines.forEach((line, idx) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${idx}`} className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-sm my-4">
              <code>{codeContent.trim()}</code>
            </pre>
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
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        const cells = line.split('|').filter(c => c.trim() && !c.match(/^[-:]+$/));
        if (cells.length > 0 && !line.match(/^\|[-:\s|]+\|$/)) {
          tableRows.push(cells.map(c => c.trim()));
        }
        return;
      } else if (inTable) {
        // End table
        elements.push(
          <div key={`table-${idx}`} className="overflow-x-auto my-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {tableRows[0]?.map((cell, i) => (
                    <th key={i} className="text-left p-2 font-semibold text-sm">{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-b border-border/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="p-2 text-sm">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={idx} className="text-2xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {line.replace('# ', '')}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={idx} className="text-xl font-semibold mt-6 mb-3 text-foreground">
            {line.replace('## ', '')}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={idx} className="text-lg font-medium mt-4 mb-2 text-foreground">
            {line.replace('### ', '')}
          </h3>
        );
      }
      // Lists
      else if (line.startsWith('- ')) {
        const text = line.replace('- ', '');
        elements.push(
          <li key={idx} className="ml-4 text-muted-foreground flex items-start gap-2 my-1">
            <span className="text-primary mt-1.5">•</span>
            <span dangerouslySetInnerHTML={{ __html: formatInlineText(text) }} />
          </li>
        );
      }
      // Checkbox items
      else if (line.startsWith('✅ ') || line.startsWith('❌ ')) {
        elements.push(
          <p key={idx} className="my-1 text-muted-foreground">
            {line}
          </p>
        );
      }
      // Numbered lists
      else if (/^\d+\.\s/.test(line)) {
        const match = line.match(/^(\d+)\.\s(.+)$/);
        if (match) {
          elements.push(
            <li key={idx} className="ml-4 text-muted-foreground flex items-start gap-2 my-1">
              <span className="text-primary font-semibold">{match[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: formatInlineText(match[2]) }} />
            </li>
          );
        }
      }
      // Empty lines
      else if (line.trim() === '') {
        elements.push(<div key={idx} className="h-2" />);
      }
      // Regular paragraphs
      else if (line.trim()) {
        elements.push(
          <p key={idx} className="text-muted-foreground my-2" 
             dangerouslySetInnerHTML={{ __html: formatInlineText(line) }} />
        );
      }
    });

    return elements;
  };

  const formatInlineText = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-primary text-sm">$1</code>');
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Slide Content */}
      <div className={cn(
        "flex-1 overflow-y-auto",
        compact ? "p-4" : "p-6 md:p-8"
      )}>
        <div className="max-w-3xl mx-auto">
          {/* Key Points Badge */}
          {!compact && currentSlide.keyPoints.length > 0 && (
            <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <h4 className="text-sm font-semibold text-primary mb-2">Key Takeaways</h4>
              <ul className="space-y-1">
                {currentSlide.keyPoints.map((point, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Main Content */}
          <div className="prose prose-invert max-w-none">
            {renderContent(currentSlide.content)}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <Button
            variant="ghost"
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
                  "w-2.5 h-2.5 rounded-full transition-all",
                  index === currentIndex 
                    ? "bg-primary w-6" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                title={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            onClick={goToNext}
            disabled={currentIndex === slides.length - 1}
            className="gap-2"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress text */}
        <p className="text-center text-xs text-muted-foreground mt-2">
          Slide {currentIndex + 1} of {totalSlides}
        </p>
      </div>
    </div>
  );
};
