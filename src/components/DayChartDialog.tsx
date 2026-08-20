import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getFiveMinuteBars, type IntradayBar } from "@/lib/intraday.functions";
import type { ForecastRecord } from "@/lib/forecast.functions";

const fmt = (v: number) =>
  Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function downloadCsv(date: string, bars: IntradayBar[]) {
  const csv = [
    "time,open,high,low,close",
    ...bars.map((b) => `${b.time},${b.open},${b.high},${b.low},${b.close}`),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `nifty-5min-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPng(date: string, container: HTMLElement | null) {
  const svg = container?.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const width = svg.clientWidth || 900;
  const height = svg.clientHeight || 420;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const styles = getComputedStyle(document.body);
  const bg = styles.backgroundColor || "#0b0e13";
  const data = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("render failed"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
  });
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `nifty-5min-${date}.png`;
  a.click();
}

export function DayChartDialog({ row }: { row: ForecastRecord }) {
  const [open, setOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const fetchBars = useServerFn(getFiveMinuteBars);
  const date = row.forecast_date;

  const { data, isLoading, error } = useQuery({
    queryKey: ["five-minute-bars", date],
    queryFn: () => fetchBars({ data: { date } }),
    enabled: open,
    staleTime: Infinity,
  });

  const low = Number(row.expected_low);
  const high = Number(row.expected_high);
  const mid = (low + high) / 2;
  const dayHigh = row.actual_high === null ? null : Number(row.actual_high);
  const dayLow = row.actual_low === null ? null : Number(row.actual_low);

  const bars = data ?? [];
  const values = bars.flatMap((b) => [b.high, b.low]);
  const bounds = [...values, low, high, ...(dayHigh ? [dayHigh] : []), ...(dayLow ? [dayLow] : [])];
  const pad = 15;
  const domain: [number, number] = bounds.length
    ? [Math.min(...bounds) - pad, Math.max(...bounds) + pad]
    : [0, 1];

  const chartData = bars.map((b) => ({
    time: b.time,
    close: b.close,
    band: [low, high] as [number, number],
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
          Chart
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-base">NIFTY 5-minute chart · {date}</DialogTitle>
        </DialogHeader>

        <div className="num flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="text-accent-foreground">
            Predicted range {fmt(low)} — {fmt(high)}
          </span>
          <span className="text-primary">Midpoint {fmt(mid)}</span>
          {dayHigh !== null && <span className="text-bull">Day high {fmt(dayHigh)}</span>}
          {dayLow !== null && <span className="text-bear">Day low {fmt(dayLow)}</span>}
        </div>

        <div ref={chartRef} className="mt-2 h-[420px] w-full">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading 5-minute candles…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-bear">
              {(error as Error).message}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 60, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={28} />
                <YAxis
                  domain={domain}
                  tick={{ fontSize: 11 }}
                  width={70}
                  tickFormatter={(v: number) => fmt(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => fmt(Number(v))}
                />
                <Area
                  dataKey="band"
                  stroke="none"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.12}
                  isAnimationActive={false}
                  activeDot={false}
                  legendType="none"
                  tooltipType="none"
                />
                <ReferenceLine
                  y={low}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="5 4"
                  label={{ value: "pred low", position: "right", fontSize: 10 }}
                />
                <ReferenceLine
                  y={high}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="5 4"
                  label={{ value: "pred high", position: "right", fontSize: 10 }}
                />
                <ReferenceLine
                  y={mid}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="2 6"
                  label={{ value: "mid", position: "right", fontSize: 10 }}
                />
                {dayHigh !== null && (
                  <ReferenceLine
                    y={dayHigh}
                    stroke="hsl(var(--bull, 142 71% 45%))"
                    label={{ value: "day high", position: "right", fontSize: 10 }}
                  />
                )}
                {dayLow !== null && (
                  <ReferenceLine
                    y={dayLow}
                    stroke="hsl(var(--bear, 0 72% 55%))"
                    label={{ value: "day low", position: "right", fontSize: 10 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={bars.length === 0}
            onClick={() => void downloadPng(date, chartRef.current)}
          >
            Download chart (PNG)
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bars.length === 0}
            onClick={() => downloadCsv(date, bars)}
          >
            Download 5-min data (CSV)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
