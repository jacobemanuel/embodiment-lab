import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface VerticalProgressBarProps {
  totalQuestions: number;
  answeredQuestions: number;
  questionIds: string[];
  responses: Record<string, string>;
  isQuestionComplete?: (questionId: string) => boolean;
  onQuestionClick?: (index: number) => void;
}

export const VerticalProgressBar = ({
  totalQuestions,
  answeredQuestions,
  questionIds,
  responses,
  isQuestionComplete,
  onQuestionClick
}: VerticalProgressBarProps) => {
  if (totalQuestions === 0) return null;

  // Find first unanswered question index
  const firstUnansweredIndex = questionIds.findIndex(id =>
    isQuestionComplete ? !isQuestionComplete(id) : !responses[id]
  );
  const hasUnanswered = firstUnansweredIndex !== -1;

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-center">
      {/* Question dots with connecting line */}
      <div className="relative flex flex-col items-center gap-3">
        {/* Gray connecting line behind dots */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-border rounded-full"
          style={{ 
            top: 6, 
            bottom: 6,
            height: `calc(100% - 12px)`
          }}
        />
        
        {questionIds.map((id, index) => {
          const isAnswered = isQuestionComplete ? isQuestionComplete(id) : !!responses[id];
          const isFirstUnanswered = index === firstUnansweredIndex;
          
          return (
            <button
              key={id}
              onClick={() => onQuestionClick?.(index)}
              className={cn(
                "relative z-10 w-3 h-3 rounded-full transition-all duration-300 border-2",
                isAnswered 
                  ? "bg-primary border-primary" 
                  : isFirstUnanswered
                    ? "bg-background border-primary animate-pulse scale-125"
                    : "bg-background border-muted-foreground/40"
              )}
              title={`Question ${index + 1}${isAnswered ? ' (answered)' : ''}`}
            />
          );
        })}
      </div>

      {/* Scroll indicator */}
      {hasUnanswered && (
        <div className="mt-3 flex flex-col items-center text-muted-foreground animate-bounce">
          <ChevronDown className="w-4 h-4" />
          <span className="text-[10px] font-medium">{totalQuestions - answeredQuestions} left</span>
        </div>
      )}

      {/* Counter */}
      <div className="mt-2 text-xs font-medium text-muted-foreground">
        {answeredQuestions}/{totalQuestions}
      </div>
    </div>
  );
};
