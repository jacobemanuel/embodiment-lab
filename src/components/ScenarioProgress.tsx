interface ScenarioProgressProps {
  current: number;
  total: number;
}

export const ScenarioProgress = ({ current, total }: ScenarioProgressProps) => {
  const percentage = (current / total) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Progress</span>
        <span>Scenario {current} of {total}</span>
      </div>
      <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
