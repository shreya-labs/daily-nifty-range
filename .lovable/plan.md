# Fix: forecast stuck on the previous day's close

## What's wrong

The daily job ran on time today (14:30 UTC / 20:00 IST), but it produced the *same* forecast again — as of 31 Jul close (24,383.6), for 3 Aug — instead of a fresh forecast for 4 Aug.

Cause (confirmed in the market-data client): the candle download window ends at **yesterday**, not today:

```text
end   = now - 24 hours
start = end - 365 days
```

So today's daily candle is never requested. The newest close the model can see is always the previous session's, and the "next trading day" it forecasts is always today rather than tomorrow.

## The fix

1. End the candle window at **today 23:59 IST**, so the session that just closed is included.
2. Compute the window dates in **IST**, not UTC, so the boundary is correct for the Indian market calendar regardless of when the job fires.
3. After the fix, trigger one run manually so a forecast for **4 Aug** (based on today's 3 Aug close) appears immediately, without waiting for tomorrow's cron.
4. The existing 3 Aug row stays as-is; the run also lets today's realized high/low/close be recorded against it so the Accuracy tab stays complete.

## Notes

- No change to the model maths, weights, cron schedule, dashboard, or Accuracy tab.
- The job runs weekdays at 14:30 UTC (20:00 IST). On a market holiday the exchange prints no new candle, so the forecast simply stays on the last real session — expected behaviour.

## Technical detail

- `src/lib/angel.server.ts` → `fetchDailyCandles`: replace the `now - 1 day` end bound with an IST-based "today" bound, and derive `fromdate`/`todate` from IST-shifted dates.
- Re-invoke `POST /api/public/hooks/daily-forecast` once to backfill the missing 4 Aug forecast, then verify the newest row in the database has `as_of_date = 2026-08-03`.
