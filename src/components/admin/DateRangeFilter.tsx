import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  autoRefreshEnabled?: boolean;
  onAutoRefreshToggle?: (enabled: boolean) => void;
}

const DateRangeFilter = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onRefresh,
  isRefreshing = false,
  autoRefreshEnabled = false,
  onAutoRefreshToggle,
}: DateRangeFilterProps) => {
  const presets = [
    { label: "Last 7 days", days: 7 },
    { label: "Last 14 days", days: 14 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
    { label: "All time", days: null },
  ];

  const handlePreset = (days: number | null) => {
    if (days === null) {
      onStartDateChange(undefined);
      onEndDateChange(undefined);
    } else {
      onStartDateChange(subDays(new Date(), days));
      onEndDateChange(new Date());
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">From:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal border-slate-600",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => {
                onStartDateChange(date);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">To:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal border-slate-600",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => {
                onEndDateChange(date);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2 border-l border-slate-600 pl-3">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="ghost"
            size="sm"
            onClick={() => handlePreset(preset.days)}
            className="text-slate-400 hover:text-white hover:bg-slate-700"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {onAutoRefreshToggle && (
          <Button
            variant={autoRefreshEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => onAutoRefreshToggle(!autoRefreshEnabled)}
            className={cn(
              "border-slate-600",
              autoRefreshEnabled && "bg-green-600 hover:bg-green-700"
            )}
          >
            {autoRefreshEnabled ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="border-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>
    </div>
  );
};

export default DateRangeFilter;
