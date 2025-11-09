import { useState } from "react";
import { MessageSquare, Mic, Video } from "lucide-react";
import { StudyMode } from "@/types/study";
import { cn } from "@/lib/utils";

interface ModuleNavigationProps {
  currentMode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
}

export const ModuleNavigation = ({ currentMode, onModeChange }: ModuleNavigationProps) => {
  const modules = [
    { id: 'text' as StudyMode, label: 'Text Mode', icon: MessageSquare },
    { id: 'voice' as StudyMode, label: 'Voice Mode', icon: Mic },
    { id: 'avatar' as StudyMode, label: 'Avatar Mode', icon: Video },
  ];

  return (
    <div className="flex items-center gap-2 p-1 bg-secondary/50 backdrop-blur-sm rounded-xl border border-border/50">
      {modules.map((module) => {
        const Icon = module.icon;
        const isActive = currentMode === module.id;
        
        return (
          <button
            key={module.id}
            onClick={() => onModeChange(module.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground shadow-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{module.label}</span>
          </button>
        );
      })}
    </div>
  );
};
