# Auto-recovery for missed daily forecasts

## Problem (verified against the database)

- 74 rows, latest as_of_date is **2026-10-29** — today's (Oct 30) run failed.
- Both cron runs today (10:30 and 11:15 UTC) returned HTTP 500 with the *old* error `Unexpected token 'A', "Access den"...` — the published deployment still runs the pre-fix build (no browser headers, no defensive JSON parsing). The cron hits the published URL, so no code fix helps until the app is published again.
- Missing as_of dates from job failures / holidays: Sep 3, 8, 14, 18, 28, 30; Oct 2, 3, 5, 8, 9, 16 (+ today Oct 30). Holiday rows can never have actuals (Sep 14, Oct 2, Oct 20 forecast dates are NSE holidays — expected).

## Plan

### 1. Auto-backfill after every successful run (the fix from the pasted diagnosis)

`src/lib/forecast.server.ts`:

- `runDailyForecast()` also returns the `vix` candle list.
- New `backfillGapsFromCandles(nifty, vix)`, called from `runAndStoreForecast()` right after `settleActuals()`:
  - Scans the last ~15 NIFTY candles (minus the newest, already stored) against `as_of_date` rows in the DB.
  - For each missing date, rebuilds the forecast using only candles available up to that close and inserts it with `forecast_date` = the *actual next candle's date* (holiday-aware, unlike `nextTradingDay`), plus its actual OHLC immediately.
  - No extra Angel API calls — reuses the candles already fetched. Best-effort: a failure never rolls back the main forecast.
- `runAndStoreForecast()` returns `{ forecast, gapsFilled }`; `src/routes/api/public/hooks/daily-forecast.ts` includes `gapsFilled` in the response so a run log shows recovered days.

### 2. One-time repair of the historical gaps

- Run the existing `backfill-forecasts` endpoint once over the missing range (Sep 18 → Oct 16, and today's Oct 30) so confirmed job-failure days (Sep 18, Sep 30, Oct 16, Oct 30) appear in the Accuracy scorecard. Holiday days stay absent (no candle exists to forecast from).

### 3. Publish

- The scheduled job calls the **published** site. All of the above only starts protecting runs after the app is published; I'll flag publishing as the final step.

## Verification

- Trigger the daily job manually, confirm `gapsFilled` is reported, the Oct 30 row appears, and the Accuracy tab shows the repaired days.
- Typecheck and build must stay green; no other behavior changes (dashboard, debug dry-run, chart tab untouched).
