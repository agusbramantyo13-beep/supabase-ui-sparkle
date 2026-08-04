import { useMemo } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "this_year"
  | "all"
  | "custom";

export interface PeriodRange {
  /** inclusive lower bound, null = unbounded */
  start: Date | null;
  /** exclusive upper bound, null = unbounded */
  end: Date | null;
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Hari Ini",
  yesterday: "Kemarin",
  this_week: "Minggu Ini",
  this_month: "Bulan Ini",
  this_year: "Tahun Ini",
  all: "Semua",
  custom: "Rentang Kustom",
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Resolves a preset (+ optional custom dates) into an explicit [start, end) range. */
export function resolvePeriod(
  preset: PeriodPreset,
  customStart?: Date | null,
  customEnd?: Date | null
): PeriodRange {
  const today = startOfDay(new Date());
  switch (preset) {
    case "today":
      return { start: today, end: addDays(today, 1) };
    case "yesterday":
      return { start: addDays(today, -1), end: today };
    case "this_week": {
      // Monday as first day of week
      const dow = (today.getDay() + 6) % 7;
      const monday = addDays(today, -dow);
      return { start: monday, end: addDays(monday, 7) };
    }
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start, end };
    }
    case "this_year": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear() + 1, 0, 1);
      return { start, end };
    }
    case "custom": {
      if (!customStart) return { start: null, end: null };
      const start = startOfDay(customStart);
      const end = customEnd ? addDays(startOfDay(customEnd), 1) : addDays(start, 1);
      return { start, end };
    }
    case "all":
    default:
      return { start: null, end: null };
  }
}

export function formatPeriodLabel(
  preset: PeriodPreset,
  range: PeriodRange
): string {
  if (preset === "all") return "Semua Waktu";
  if (preset === "today") return "Hari Ini";
  if (preset === "yesterday") return "Kemarin";
  if (!range.start || !range.end) return "Semua Waktu";
  const last = new Date(range.end.getTime() - 1);
  const f = (d: Date) => format(d, "d MMMM yyyy", { locale: localeId });
  if (startOfDay(range.start).getTime() === startOfDay(last).getTime()) {
    return f(range.start);
  }
  return `${f(range.start)} – ${f(last)}`;
}

interface Props {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  customStart: Date | null;
  customEnd: Date | null;
  onCustomChange: (start: Date | null, end: Date | null) => void;
}

export function PeriodFilter({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomChange,
}: Props) {
  const range = useMemo(
    () => resolvePeriod(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset} onValueChange={(v) => onPresetChange(v as PeriodPreset)}>
        <SelectTrigger className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((k) => (
            <SelectItem key={k} value={k}>
              {PERIOD_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start font-normal">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {customStart
                  ? format(customStart, "d MMM yyyy", { locale: localeId })
                  : "Tanggal awal"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customStart ?? undefined}
                onSelect={(d) => onCustomChange(d ?? null, customEnd)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-sm">s/d</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start font-normal">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {customEnd
                  ? format(customEnd, "d MMM yyyy", { locale: localeId })
                  : "Tanggal akhir"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customEnd ?? undefined}
                onSelect={(d) => onCustomChange(customStart, d ?? null)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <span className="text-sm text-muted-foreground">
        Periode:{" "}
        <span className="font-medium text-foreground">
          {formatPeriodLabel(preset, range)}
        </span>
      </span>
    </div>
  );
}
