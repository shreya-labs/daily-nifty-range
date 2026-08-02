import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getForecastHistory, type ForecastRecord } from "@/lib/forecast.functions";
import { TabNav } from "@/components/TabNav";

const historyQueryOptions = queryOptions({
  queryKey: ["nifty-forecast-history"],
  queryFn: () => getForecastHistory(),
});

export const Route = createFileRoute("/accuracy")({
  head: () => ({
    meta: [
      { title: "NIFTY Range Forecast Accuracy & Hit Rate" },
      {
        name: "description",
        content:
          "Backtest of NIFTY 50 next-day range forecasts: how often the predicted range held, how often it broke intraday but closed back inside, and outright misses.",
      },
      { property: "og:title", content: "NIFTY Range Forecast Accuracy & Hit Rate" },
      {
        property: "og:description",
        content:
          "Day-by-day scorecard of predicted vs actual NIFTY ranges, including intraday breaks that closed back inside.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(historyQueryOptions),
  errorComponent: ({ error }) => (
    <div role="alert" className="p-10 text-sm text-bear">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-sm">No history found.</div>,
  component: AccuracyPage,
});

const num = (value: number | string, digits = 2) =>
  Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

type Outcome = "held" | "recovered" | "failed";

function classify(row: ForecastRecord): Outcome | null {
  if (
    row.actual_high === null ||
    row.actual_low === null ||
    row.actual_close === null
  ) {
    return null;
  }
  const low = Number(row.expected_low);
  const high = Number(row.expected_high);
  const broke = Number(row.actual_high) > high || Number(row.actual_low) < low;
  if (!broke) return "held";
  const close = Number(row.actual_close);
  return close >= low && close <= high ? "recovered" : "failed";
}

const meta: Record<Outcome, { label: string; className: string }> = {
  held: { label: "Held", className: "text-bull" },
  recovered: { label: "Broke, closed inside", className: "text-primary" },
  failed: { label: "Failed", className: "text-bear" },
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function AccuracyPage() {
  const { data } = useSuspenseQuery(historyQueryOptions);

  const scored = data
    .map((row) => ({ row, outcome: classify(row) }))
    .filter((item): item is { row: ForecastRecord; outcome: Outcome } => item.outcome !== null);

  const months = Array.from(new Set(scored.map((s) => monthKey(s.row.forecast_date)))).sort(
    (a, b) => b.localeCompare(a),
  );

  const count = (items: typeof scored, outcome: Outcome) =>
    items.filter((i) => i.outcome === outcome).length;

  const total = scored.length;
  const held = count(scored, "held");
  const recovered = count(scored, "recovered");
  const failed = count(scored, "failed");
  const pct = (n: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : "—");

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-12">
      <header>
        <p className="label-xs">NIFTY 50 · forecast scorecard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Range Accuracy
        </h1>
        <TabNav />
      </header>

      <div className="mt-6 h-px w-full" style={{ backgroundImage: "var(--gradient-signal)" }} />

      {total === 0 ? (
        <div className="panel mt-10 p-10 text-center">
          <p className="text-lg font-medium">No settled forecasts yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Accuracy appears once forecasts have actual next-day highs, lows and closes
            attached.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel p-5">
              <p className="label-xs">Days scored</p>
              <p className="num mt-2 text-2xl font-semibold">{total}</p>
            </div>
            <div className="panel p-5">
              <p className="label-xs">Range held</p>
              <p className="num mt-2 text-2xl font-semibold text-bull">{held}</p>
              <p className="num mt-1 text-xs text-muted-foreground">{pct(held)}</p>
            </div>
            <div className="panel p-5">
              <p className="label-xs">Broke, closed inside</p>
              <p className="num mt-2 text-2xl font-semibold text-primary">{recovered}</p>
              <p className="num mt-1 text-xs text-muted-foreground">{pct(recovered)}</p>
            </div>
            <div className="panel p-5">
              <p className="label-xs">Failed</p>
              <p className="num mt-2 text-2xl font-semibold text-bear">{failed}</p>
              <p className="num mt-1 text-xs text-muted-foreground">{pct(failed)}</p>
            </div>
          </section>

          {months.map((month) => {
            const items = scored.filter((s) => monthKey(s.row.forecast_date) === month);
            const mHeld = count(items, "held");
            const mRecovered = count(items, "recovered");
            const mFailed = count(items, "failed");
            const title = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            });

            return (
              <section key={month} className="panel mt-4 overflow-x-auto p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-lg font-semibold">{title}</p>
                  <p className="num text-xs text-muted-foreground">
                    <span className="text-bull">{mHeld} held</span> ·{" "}
                    <span className="text-primary">{mRecovered} recovered</span> ·{" "}
                    <span className="text-bear">{mFailed} failed</span> · {items.length} days
                  </p>
                </div>

                <table className="num mt-4 w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="label-xs border-b border-border text-left">
                      <th className="pb-2 font-normal">Date</th>
                      <th className="pb-2 font-normal">Predicted range</th>
                      <th className="pb-2 font-normal">Actual low / high</th>
                      <th className="pb-2 font-normal">Close</th>
                      <th className="pb-2 font-normal">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(({ row, outcome }) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5">{row.forecast_date}</td>
                        <td className="py-2.5 text-muted-foreground">
                          {num(row.expected_low)} — {num(row.expected_high)}
                        </td>
                        <td className="py-2.5">
                          {num(row.actual_low!)} — {num(row.actual_high!)}
                        </td>
                        <td className="py-2.5">{num(row.actual_close!)}</td>
                        <td className={`py-2.5 ${meta[outcome].className}`}>
                          {meta[outcome].label}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </>
      )}

      <footer className="mt-10 text-xs text-muted-foreground">
        Outcomes compare the predicted expected low/high against the actual daily low, high
        and close. Research only — not investment advice.
      </footer>
    </main>
  );
}
