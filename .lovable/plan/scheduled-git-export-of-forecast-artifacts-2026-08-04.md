# Scheduled Git export of forecast artifacts

## What you get

- Your app source keeps syncing to GitHub through Lovable's built-in GitHub sync (connect it once from the chat + menu — nothing to build).
- The existing daily job (10:30 UTC / 4:00 PM IST, weekdays) gains one extra step: after the forecast is saved and actuals settled, it commits two files to your GitHub repo:
  - `nifty_next_day_forecast.csv`
  - `nifty_next_day_forecast.json`
  Both are overwritten each day with the latest forecast, matching your Python script's output shape.
- A commit message like `chore: nifty forecast for 2026-08-05`.
- If nothing changed, the job skips the commit instead of creating an empty one.

## Still needed from you

Which repo, branch and folder should receive the files (e.g. `youruser/nifty-forecasts`, branch `main`, folder `data/`). I'll ask again before wiring it up, or you can reply now.

## Technical details

1. **GitHub access** — connect the GitHub connector (`standard_connectors--connect`). Calls go through the Lovable connector gateway with `LOVABLE_API_KEY` + the connection key; no personal token stored in code.
2. **New module `src/lib/github-export.server.ts`**
   - `serializeForecast(forecast)` builds the CSV (header + one row) and pretty JSON.
   - `putFile(path, contents, message)` — `GET repos/{owner}/{repo}/contents/{path}?ref={branch}` to read the current `sha` and content, compare, then `PUT` the same path with base64 content, `sha` (when it exists) and `branch`. Skip when identical.
   - Repo/branch/folder read from env config; surfaces the GitHub status + body on failure rather than a generic 500.
3. **Wire-in** — `runAndStoreForecast()` in `src/lib/forecast.server.ts` calls the export after `settleActuals`, wrapped in try/catch so an export failure never fails the forecast run. Result reported in the `/api/public/hooks/daily-forecast` response payload.
4. **Manual trigger** — new `POST /api/public/hooks/export-github` to re-push the latest stored forecast on demand (useful for testing without waiting for the cron).
5. **No schedule change** — the existing `invoke-daily-nifty-forecast` pg_cron entry keeps its `30 10 * * 1-5` timing; no DB migration required.

## Not included

- Pushing the app's own source from the job (the runtime has no checkout; GitHub sync handles that).
- Dated per-day snapshots or full-history CSV — say the word and I'll add them.
