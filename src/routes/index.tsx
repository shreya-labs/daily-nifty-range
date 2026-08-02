import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getForecasts, type ForecastRecord } from "@/lib/forecast.functions";

const forecastsQueryOptions = queryOptions({
  queryKey: ["nifty-forecasts"],
  queryFn: () => getForecasts(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NIFTY Next-Day Range Forecast Dashboard" },
      {
        name: "description",
        content:
          "Daily NIFTY 50 next-day expected range forecast built from HV, ATR, realized volatility, EWMA and India VIX, logged every trading day.",
      },
      { property: "og:title", content: "NIFTY Next-Day Range Forecast Dashboard" },
      {
        property: "og:description",
        content:
          "Daily NIFTY 50 expected move, 68% and 95% closing ranges, and model component breakdown.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(forecastsQueryOptions),
  component: Dashboard,
});

const num = (value: number | string, digits = 2) =>
  Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "bull" | "bear" | "signal";
}) {
  const toneClass =
    tone === "bull"
      ? "text-bull"
      : tone === "bear"
        ? "text-bear"
        : tone === "signal"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="panel p-5">
      <p className="label-xs">{label}</p>
      <p className={`num mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint ? <p className="num mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RangeBar({ forecast }: { forecast: ForecastRecord }) {
  const low = Number(forecast.close_95_low);
  const high = Number(forecast.close_95_high);
  const span = high - low || 1;
  const pos = (v: number) => `${(((v - low) / span) * 100).toFixed(2)}%`;

  return (
    <div className="panel p-6">
      <p className="label-xs">Projected closing distribution</p>
      <div className="relative mt-8 h-2 rounded-full bg-secondary">
        <div
          className="absolute inset-y-0 rounded-full bg-accent/25"
          style={{
            left: pos(Number(forecast.close_68_low)),
            right: `calc(100% - ${pos(Number(forecast.close_68_high))})`,
          }}
        />
        <div
          className="absolute top-1/2 h-6 w-0.5 -translate-y-1/2 bg-primary"
          style={{ left: pos(Number(forecast.last_close)) }}
        />
      </div>
      <div className="num mt-4 flex justify-between text-xs text-muted-foreground">
        <span className="text-bear">{num(forecast.close_95_low)}</span>
        <span className="text-primary">last close {num(forecast.last_close)}</span>
        <span className="text-bull">{num(forecast.close_95_high)}</span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
          <p className="label-xs">68% closing range</p>
          <p className="num mt-1 text-sm">
            {num(forecast.close_68_low)} — {num(forecast.close_68_high)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
          <p className="label-xs">95% closing range</p>
          <p className="num mt-1 text-sm">
            {num(forecast.close_95_low)} — {num(forecast.close_95_high)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ModelBreakdown({ forecast }: { forecast: ForecastRecord }) {
  const rows = [
    { label: "HV (30)", value: Number(forecast.hv30_points), weight: "20%" },
    { label: "ATR (14) half range", value: Number(forecast.atr14_half_range_points), weight: "25%" },
    { label: "Realized vol (20)", value: Number(forecast.rv20_points), weight: "20%" },
    { label: "EWMA", value: Number(forecast.ewma_points), weight: "15%" },
    { label: "VIX implied", value: Number(forecast.vix_implied_points), weight: "20%" },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="panel p-6">
      <p className="label-xs">Model components (points)</p>
      <ul className="mt-5 space-y-4">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span>
                {row.label}{" "}
                <span className="num text-xs text-muted-foreground">· w {row.weight}</span>
              </span>
              <span className="num font-medium">{num(row.value)}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dashboard() {
  const { data } = useSuspenseQuery(forecastsQueryOptions);
  const latest = data[0];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">NIFTY 50 · daily prediction log</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Next-Day Range Forecast
          </h1>
        </div>
        <div className="num text-right text-xs text-muted-foreground">
          <p>Version 2 ensemble</p>
          <p>HV · ATR · RV · EWMA · India VIX</p>
        </div>
      </header>

      <div className="mt-6 h-px w-full" style={{ backgroundImage: "var(--gradient-signal)" }} />

      {!latest ? (
        <div className="panel mt-10 p-10 text-center">
          <p className="text-lg font-medium">No forecast logged yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The daily job runs each evening after market close and records the next
            trading day&apos;s expected range here.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-8 panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="label-xs">Forecast for</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatDate(latest.forecast_date)}
                </p>
              </div>
              <div className="num text-right text-xs text-muted-foreground">
                <p>Data as of {formatDate(latest.as_of_date)}</p>
                <p>India VIX {num(latest.india_vix)}</p>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Last close" value={num(latest.last_close)} tone="signal" />
            <Stat
              label="Expected move"
              value={`± ${num(latest.expected_move_points)}`}
              hint={`± ${num(latest.expected_move_percent, 4)}%`}
            />
            <Stat label="Expected low" value={num(latest.expected_low)} tone="bear" />
            <Stat label="Expected high" value={num(latest.expected_high)} tone="bull" />
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <RangeBar forecast={latest} />
            <ModelBreakdown forecast={latest} />
          </section>

          {data.length > 1 && (
            <section className="panel mt-4 overflow-x-auto p-6">
              <p className="label-xs">Prediction history</p>
              <table className="num mt-4 w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="label-xs border-b border-border text-left">
                    <th className="pb-2 font-normal">Forecast date</th>
                    <th className="pb-2 font-normal">Last close</th>
                    <th className="pb-2 font-normal">VIX</th>
                    <th className="pb-2 font-normal">Move</th>
                    <th className="pb-2 font-normal">Range</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5">{row.forecast_date}</td>
                      <td className="py-2.5">{num(row.last_close)}</td>
                      <td className="py-2.5 text-muted-foreground">{num(row.india_vix)}</td>
                      <td className="py-2.5">± {num(row.expected_move_points)}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {num(row.expected_low)} — {num(row.expected_high)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      <footer className="mt-10 text-xs text-muted-foreground">
        Statistical range estimate for research only. Not investment advice.
      </footer>
    </main>
  );
}
