import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { runForecastForDate, runTodayForecast } from "@/lib/debug.functions";
import { TabNav } from "@/components/TabNav";

export const Route = createFileRoute("/debug")({
  head: () => ({
    meta: [
      { title: "NIFTY Forecast Job Debug Console" },
      {
        name: "description",
        content:
          "Manually re-run the NIFTY range forecast job for any trading date and inspect the result, for debugging the daily schedule.",
      },
      { property: "og:title", content: "NIFTY Forecast Job Debug Console" },
      {
        property: "og:description",
        content: "Re-run the daily NIFTY range forecast job for a chosen date.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DebugPage,
});

function DebugPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const runForDate = useServerFn(runForecastForDate);
  const runToday = useServerFn(runTodayForecast);

  const dateJob = useMutation({
    mutationFn: (d: string) => runForDate({ data: { date: d } }),
  });
  const todayJob = useMutation({ mutationFn: () => runToday() });

  const busy = dateJob.isPending || todayJob.isPending;

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
        <p className="label-xs">Run forecast for a specific date</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Recomputes the forecast for that trading date using only data available up to
          the prior close, and attaches the realized OHLC if it has printed.
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
            onClick={() => dateJob.mutate(date)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {dateJob.isPending ? "Running…" : "Run job for date"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => todayJob.mutate()}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {todayJob.isPending ? "Running…" : "Run today's live job"}
          </button>
        </div>

        <div className="mt-6 space-y-3 text-sm">
          {dateJob.isError && (
            <p className="text-bear">Date job failed: {dateJob.error.message}</p>
          )}
          {dateJob.isSuccess && (
            <p className="num text-bull">
              Wrote {dateJob.data.inserted} row(s)
              {dateJob.data.dates.length ? ` · ${dateJob.data.dates.join(", ")}` : ""}
              {dateJob.data.inserted === 0
                ? " — no trading candle for that date (holiday/weekend or not printed yet)."
                : ""}
            </p>
          )}
          {todayJob.isError && (
            <p className="text-bear">Live job failed: {todayJob.error.message}</p>
          )}
          {todayJob.isSuccess && (
            <p className="num text-bull">
              Stored forecast for {todayJob.data.forecast_date} (as of{" "}
              {todayJob.data.as_of_date}).
            </p>
          )}
        </div>
      </section>

      <footer className="mt-10 text-xs text-muted-foreground">
        Debug tooling — runs the same code path as the scheduled daily job.
      </footer>
    </main>
  );
}
