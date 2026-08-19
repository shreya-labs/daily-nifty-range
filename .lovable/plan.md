# Fix: 18 Aug job fired but no forecast for 19 Aug

## What actually happened

The scheduled job did fire on 18 Aug at 10:30 UTC. But the HTTP call it makes to the
forecast endpoint was cut off after **5 seconds**:

```text
timed_out: true
Timeout of 5000 ms reached. Total time: 5001 ms
```

The forecast run needs longer than that — it logs into the market-data provider,
downloads a year of NIFTY candles, waits 3 seconds, then downloads India VIX,
plus retry/backoff when the provider throttles. When the caller hangs up at 5s the
run is dropped, so nothing was written.

Confirmed in the database: the newest row is still `forecast_date = 2026-08-18`
(as of 17 Aug close), and 18 Aug has no realized close settled yet. That is why the
page still shows the older forecast.

## The fix

1. **Give the scheduled call enough time.** Reschedule the daily job with an explicit
   60-second timeout instead of the 5-second default, so the run can finish.
2. **Add a catch-up run.** A second scheduled call 45 minutes later (11:15 UTC).
   The endpoint already upserts by forecast date, so a repeat run is harmless — it
   simply fills the gap when the first attempt fails.
3. **Backfill now.** Trigger one run manually so the 19 Aug forecast appears
   immediately and 18 Aug's realized high/low/close is settled for the Accuracy tab.

## Notes

- No change to the model maths, weights, dashboard, or Accuracy tab.
- Main run stays at 10:30 UTC (4:00 PM IST), weekdays.

## Technical detail

- `cron.unschedule('invoke-daily-nifty-forecast')`, then reschedule the same
  `net.http_post(...)` with `timeout_milliseconds := 60000`.
- Add `invoke-daily-nifty-forecast-retry` at `15 11 * * 1-5` with the same body and
  timeout, hitting `POST /api/public/hooks/daily-forecast`.
- Manually `POST /api/public/hooks/daily-forecast`, then verify the newest row has
  `forecast_date = 2026-08-19` and `actual_close` is set on 2026-08-18.
