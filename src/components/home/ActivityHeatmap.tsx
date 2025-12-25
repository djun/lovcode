import { useMemo } from "react";

interface ActivityHeatmapProps {
  /** Map of date string (YYYY-MM-DD) to session count */
  data: Map<string, number>;
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const { weeks, maxCount, totalSessions } = useMemo(() => {
    const today = new Date();
    const cells: { date: string; count: number; dayOfWeek: number }[] = [];

    // Find earliest date in data to determine range
    let earliestDate = today;
    data.forEach((_, dateStr) => {
      const d = new Date(dateStr);
      if (d < earliestDate) earliestDate = d;
    });

    // At least show 12 weeks, or extend to cover all data
    const minWeeks = 12;
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceEarliest = Math.ceil((today.getTime() - earliestDate.getTime()) / msPerDay);
    const weeksNeeded = Math.max(minWeeks, Math.ceil(daysSinceEarliest / 7) + 1);
    const daysToShow = weeksNeeded * 7;

    // Generate cells for each day
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      cells.push({
        date: dateStr,
        count: data.get(dateStr) || 0,
        dayOfWeek: d.getDay(),
      });
    }

    // Group into weeks (columns)
    const weeks: typeof cells[] = [];
    let currentWeek: typeof cells = [];

    // Pad first week if needed
    const firstDayOfWeek = cells[0]?.dayOfWeek || 0;
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ date: "", count: 0, dayOfWeek: i });
    }

    cells.forEach((cell) => {
      if (cell.dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(cell);
    });
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const maxCount = Math.max(...cells.map((c) => c.count), 1);
    const totalSessions = cells.reduce((sum, c) => sum + c.count, 0);

    return { weeks, maxCount, totalSessions };
  }, [data]);

  const getColorClass = (count: number): string => {
    if (count === 0) return "bg-muted/30";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "bg-primary/20";
    if (ratio < 0.5) return "bg-primary/40";
    if (ratio < 0.75) return "bg-primary/70";
    return "bg-primary";
  };

  const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Activity
        </span>
        <span className="text-xs text-muted-foreground">
          {totalSessions.toLocaleString()} chats
        </span>
      </div>

      <div className="flex gap-1">
        {/* Week day labels */}
        <div className="flex flex-col gap-[3px] text-[10px] text-muted-foreground/70 pr-1">
          {weekLabels.map((label, i) => (
            <div key={i} className="h-[11px] flex items-center">
              {i % 2 === 1 ? label : ""}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex gap-[3px] overflow-x-auto">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-[3px]">
              {week.map((cell, dayIdx) => (
                <div
                  key={dayIdx}
                  className={`w-[11px] h-[11px] rounded-sm ${
                    cell.date ? getColorClass(cell.count) : "bg-transparent"
                  }`}
                  title={cell.date ? `${cell.date}: ${cell.count} chats` : ""}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground/70">
        <span>Less</span>
        <div className="w-[11px] h-[11px] rounded-sm bg-muted/30" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary/20" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary/40" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary/70" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary" />
        <span>More</span>
      </div>
    </div>
  );
}
