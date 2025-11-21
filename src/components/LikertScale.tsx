import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LikertScaleProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  labels?: string[];
}

const defaultLabels = [
  "Strongly disagree",
  "Disagree", 
  "Neutral",
  "Agree",
  "Strongly agree"
];

export const LikertScale = ({ 
  id, 
  value, 
  onChange, 
  labels = defaultLabels 
}: LikertScaleProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {labels.map((label, index) => {
          const optionValue = String(index + 1);
          const isSelected = value === optionValue;
          
          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              className={cn(
                "group relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                "hover:border-primary/50 hover:bg-primary/5 hover:scale-105",
                isSelected 
                  ? "border-primary bg-primary/10 shadow-md scale-105" 
                  : "border-border bg-card"
              )}
            >
              {/* Radio indicator */}
              <div className={cn(
                "w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center",
                isSelected 
                  ? "border-primary bg-primary" 
                  : "border-muted-foreground/30 group-hover:border-primary/50"
              )}>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                )}
              </div>
              
              {/* Number */}
              <span className={cn(
                "text-xl font-bold transition-colors",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}>
                {index + 1}
              </span>
              
              {/* Label */}
              <span className={cn(
                "text-xs text-center leading-tight font-medium transition-colors",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Mobile-friendly alternative */}
      <div className="md:hidden space-y-2">
        {labels.map((label, index) => {
          const optionValue = String(index + 1);
          const isSelected = value === optionValue;
          
          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                "hover:border-primary/50 hover:bg-primary/5",
                isSelected 
                  ? "border-primary bg-primary/10" 
                  : "border-border bg-card"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
              )}>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                )}
              </div>
              <span className={cn(
                "font-bold mr-2",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}>
                {index + 1}
              </span>
              <span className={cn(
                "text-sm flex-1 text-left",
                isSelected ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
