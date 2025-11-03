import { Slider } from "@/components/ui/slider";
import { useState } from "react";

interface ConfidenceSliderProps {
  label: string;
  onValueChange: (value: number) => void;
  defaultValue?: number;
}

export const ConfidenceSlider = ({ label, onValueChange, defaultValue = 5 }: ConfidenceSliderProps) => {
  const [value, setValue] = useState(defaultValue);
  
  const handleChange = (values: number[]) => {
    setValue(values[0]);
    onValueChange(values[0]);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-2xl font-semibold text-primary">{value}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={handleChange}
        min={1}
        max={10}
        step={1}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Not confident</span>
        <span>Very confident</span>
      </div>
    </div>
  );
};
