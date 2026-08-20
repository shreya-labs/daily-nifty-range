import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { previewForecastForDate, previewLatestForecast } from "@/lib/debug.functions";
import { TabNav } from "@/components/TabNav";

export const Route = createFileRoute("/debug")({
  head: () => ({
    meta: [
      { title: "NIFTY Forecast Job Debug Console" },
      {
        name: "description",
        content:
          "Dry-run the NIFTY range forecast for any trading date and read the computed output on screen, without changing any stored records.",
      },
      { property: "og:title", content: "NIFTY Forecast Job Debug Console" },
      {
        property: "og:description",
        content: "Read-only dry run of the daily NIFTY range forecast for a chosen date.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DebugPage,
});

const num = (value: number | string, digits = 2) =>
  Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

type Preview = Awaited<ReturnType<typeof previewLatestForecast>>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}

function Result({ result }: { result: Preview }) {
  const f = result.forecast;
  const a = result.actual;
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="panel p-6 text-sm">
        <p className="label-xs">Computed forecast (not saved)</p>
        <div className="mt-4">
          <Row label="Forecast date" value={f.forecast_date} />
          <Row label="Data as of" value={f.as_of_date} />
          <Row label="Last close" value={num(f.last_close)} />
          <Row label="India VIX" value={num(f.india_vix)} />
          <Row
            label="Expected move"
            value={`± ${num(f.expected_move_points)} (${num(f.expected_move_percent, 4)}%)`}
          />
          <Row
            label="Expected range"
            value={`${num(f.expected_low)} — ${num(f.expected_high)}`}
          />
          <Row label="68% close" value={`${num(f.close_68_low)} — ${num(f.close_68_high)}`} />
          <Row label="95% close" value={`${num(f.close_95_low)} — ${num(f.close_95_high)}`} />
        </div>
      </div>

      <div className="panel p-6 text-sm">
        <p className="label-xs">Components & realized</p>
        <div className="mt-4">
          <Row label="HV (30) · w 20%" value={num(f.hv30_points)} />
          <Row label="ATR (14) half · w 25%" value={num(f.atr14_half_range_points)} />
          <Row label="Realized vol (20) · w 20%" value={num(f.rv20_points)} />
          <Row label="EWMA · w 15%" value={num(f.ewma_points)} />
          <Row label="VIX implied · w 20%" value={num(f.vix_implied_points)} />
          {a ? (
            <>
              <Row label="Actual open" value={num(a.open)} />
              <Row label="Actual high" value={num(a.high)} />
              <Row label="Actual low" value={num(a.low)} />
              <Row label="Actual close" value={num(a.close)} />
              <Row
                label="Range verdict"
                value={
                  a.high <= Number(f.expected_high) && a.low >= Number(f.expected_low)
                    ? "Held"
                    : a.close <= Number(f.expected_high) && a.close >= Number(f.expected_low)
                      ? "Broke, closed inside"
                      : "Failed"
                }
              />
            </>
          ) : (
            <Row label="Actuals" value="not printed yet" />
          )}
        </div>
      </div>

      <details className="panel p-6 lg:col-span-2">
        <summary className="label-xs cursor-pointer">Raw output</summary>
        <pre className="num mt-4 overflow-x-auto text-xs text-muted-foreground">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function DebugPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const runForDate = useServerFn(previewForecastForDate);
  const runLatest = useServerFn(previewLatestForecast);

  const dateJob = useMutation({
    mutationFn: (d: string) => runForDate({ data: { date: d } }),
  });
  const latestJob = useMutation({ mutationFn: () => runLatest() });

  const busy = dateJob.isPending || latestJob.isPending;
  const result = dateJob.data ?? latestJob.data;
  const error = dateJob.error ?? latestJob.error;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-12">
      <header>
        <p className="label-xs">NIFTY 50 · maintenance</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Job Debug Console
        </h1>
        <TabNav />
      </header>

      <div className="mt-6 h-px w-full" style={{ backgroundImage: "var(--gradient-signal)" }} />

      <section className="panel mt-8 p-6">
        <p className="label-xs">Dry run — nothing is saved</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Runs the same model for the chosen forecast date using only data available up
          to the prior close, and prints the result here. No database rows, exports or
          files are written.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="num rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm"
            aria-label="Forecast date"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              latestJob.reset();
              dateJob.mutate(date);
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {dateJob.isPending ? "Running…" : "Run for date"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              dateJob.reset();
              latestJob.mutate();
            }}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {latestJob.isPending ? "Running…" : "Run on latest data"}
          </button>
        </div>

        {error ? <p className="mt-5 text-sm text-bear">{error.message}</p> : null}
      </section>

      {result ? <Result result={result} /> : null}

      <footer className="mt-10 text-xs text-muted-foreground">
        Read-only debug tooling — the scheduled daily job remains the only writer.
      </footer>
    </main>
  );
}
