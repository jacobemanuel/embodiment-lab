import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface VerticalProgressBarProps {
  totalQuestions: number;
  answeredQuestions: number;
  questionIds: string[];
  responses: Record<string, string>;
  onQuestionClick?: (index: number) => void;
}

export const VerticalProgressBar = ({
  totalQuestions,
  answeredQuestions,
  questionIds,
  responses,
  onQuestionClick
}: VerticalProgressBarProps) => {
  if (totalQuestions === 0) return null;

  const progress = (answeredQuestions / totalQuestions) * 100;
  
  // Find first unanswered question index
  const firstUnansweredIndex = questionIds.findIndex(id => !responses[id]);
  const hasUnanswered = firstUnansweredIndex !== -1;

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-center gap-2">
      {/* Progress track */}
      <div className="relative w-2 bg-secondary rounded-full overflow-hidden" style={{ height: `${Math.max(totalQuestions * 24, 120)}px` }}>
        <div 
          className="absolute bottom-0 left-0 w-full bg-primary rounded-full transition-all duration-500"
          style={{ height: `${progress}%` }}
        />
      </div>
      
      {/* Question dots */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col justify-between h-full py-1" style={{ height: `${Math.max(totalQuestions * 24, 120)}px` }}>
        {questionIds.map((id, index) => {
          const isAnswered = !!responses[id];
          const isFirstUnanswered = index === firstUnansweredIndex;
          
          return (
            <button
              key={id}
              onClick={() => onQuestionClick?.(index)}
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-300 border-2",
                isAnswered 
                  ? "bg-primary border-primary scale-100" 
                  : isFirstUnanswered
                    ? "bg-background border-primary animate-pulse scale-110"
                    : "bg-background border-muted-foreground/30 scale-90"
              )}
              title={`Question ${index + 1}${isAnswered ? ' (answered)' : ''}`}
            />
          );
        })}
      </div>

      {/* Scroll indicator */}
      {hasUnanswered && (
        <div className="mt-2 flex flex-col items-center text-muted-foreground animate-bounce">
          <ChevronDown className="w-4 h-4" />
          <span className="text-[10px] font-medium">{totalQuestions - answeredQuestions} left</span>
        </div>
      )}

      {/* Counter */}
      <div className="mt-1 text-xs font-medium text-muted-foreground">
        {answeredQuestions}/{totalQuestions}
      </div>
    </div>
  );
};
