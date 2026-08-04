// NIFTY next-day range forecast — port of nifty_range_predictor_v2.py
import { fetchDailyCandles, login, type Candle } from "./angel.server";

const TRADING_DAYS = 252;
const EWMA_LAMBDA = 0.94;

const WEIGHTS = {
  hv30: 0.2,
  atr14: 0.25,
  rv20: 0.2,
  ewma: 0.15,
  india_vix: 0.2,
} as const;

export type Forecast = {
  as_of_date: string;
  forecast_date: string;
  last_close: number;
  india_vix: number;
  expected_move_points: number;
  expected_move_percent: number;
  expected_low: number;
  expected_high: number;
  expected_total_range_points: number;
  close_68_low: number;
  close_68_high: number;
  close_95_low: number;
  close_95_high: number;
  hv30_points: number;
  atr14_half_range_points: number;
  rv20_points: number;
  ewma_points: number;
  vix_implied_points: number;
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function sampleStd(values: number[]): number {
  if (values.length < 2) throw new Error("Not enough data points for std dev");
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function atr14(candles: Candle[]): number {
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const prevClose = candles[i - 1]!.close;
    trueRanges.push(
      Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)),
    );
  }
  const tail = trueRanges.slice(-14);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

function ewmaDailyVolatility(returns: number[]): number {
  if (returns.length < 2) throw new Error("Not enough returns for EWMA calculation");
  let variance = sampleStd(returns.slice(0, Math.min(20, returns.length))) ** 2;
  for (const value of returns) {
    variance = EWMA_LAMBDA * variance + (1 - EWMA_LAMBDA) * value ** 2;
  }
  return Math.sqrt(Math.max(variance, 0));
}

function nextTradingDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

export function buildForecast(nifty: Candle[], vix: Candle[]): Forecast {
  if (nifty.length < 31) throw new Error("At least 31 NIFTY daily candles are required.");
  if (vix.length === 0) throw new Error("INDIA VIX data is empty.");

  const closes = nifty.map((c) => c.close);
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i]! / closes[i - 1]!));
  }

  const lastCandle = nifty[nifty.length - 1]!;
  const lastClose = lastCandle.close;
  const currentVix = vix[vix.length - 1]!.close;

  const hv30 = sampleStd(returns.slice(-30)) * lastClose;
  const rv20 = sampleStd(returns.slice(-20)) * lastClose;
  const ewma = ewmaDailyVolatility(returns) * lastClose;
  const vixPoints = (currentVix / 100 / Math.sqrt(TRADING_DAYS)) * lastClose;
  const atrHalf = atr14(nifty) / 2;

  const expectedMove =
    hv30 * WEIGHTS.hv30 +
    atrHalf * WEIGHTS.atr14 +
    rv20 * WEIGHTS.rv20 +
    ewma * WEIGHTS.ewma +
    vixPoints * WEIGHTS.india_vix;

  const asOfDate = lastCandle.datetime.slice(0, 10);

  return {
    as_of_date: asOfDate,
    forecast_date: nextTradingDay(asOfDate),
    last_close: round(lastClose),
    india_vix: round(currentVix),
    expected_move_points: round(expectedMove),
    expected_move_percent: round((expectedMove / lastClose) * 100, 4),
    expected_low: round(Math.max(0, lastClose - expectedMove)),
    expected_high: round(lastClose + expectedMove),
    expected_total_range_points: round(2 * expectedMove),
    close_68_low: round(Math.max(0, lastClose - expectedMove)),
    close_68_high: round(lastClose + expectedMove),
    close_95_low: round(Math.max(0, lastClose - 1.96 * expectedMove)),
    close_95_high: round(lastClose + 1.96 * expectedMove),
    hv30_points: round(hv30),
    atr14_half_range_points: round(atrHalf),
    rv20_points: round(rv20),
    ewma_points: round(ewma),
    vix_implied_points: round(vixPoints),
  };
}

export async function runDailyForecast(): Promise<{ forecast: Forecast; nifty: Candle[] }> {
  const apiKey = process.env["ANGEL_API_KEY"];
  const clientId = process.env["ANGEL_CLIENT_ID"];
  const password = process.env["ANGEL_CLIENT_PASSWORD"];
  const totpSecret = process.env["ANGEL_TOTP_SECRET"];
  // The historical/candle API accepts the same key used for login (matches auth.py).
  const historicalApiKey = apiKey;


  if (!apiKey || !clientId || !password || !totpSecret || !historicalApiKey) {
    throw new Error("Missing Angel One credentials");
  }

  const jwt = await login({ apiKey, clientId, password, totpSecret });

  const nifty = await fetchDailyCandles({
    jwt,
    historicalApiKey,
    exchange: "NSE",
    symbolToken: "99926000",
    name: "NIFTY_50",
  });
  await new Promise((r) => setTimeout(r, 3000));
  const vix = await fetchDailyCandles({
    jwt,
    historicalApiKey,
    exchange: "NSE",
    symbolToken: "99926017",
    name: "INDIA_VIX",
  });

  return { forecast: buildForecast(nifty, vix), nifty };
}

export async function runAndStoreForecast(): Promise<Forecast> {
  const { forecast, nifty } = await runDailyForecast();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("nifty_forecasts")
    .upsert(forecast, { onConflict: "forecast_date" });
  if (error) throw new Error(`Failed to save forecast: ${error.message}`);

  await settleActuals(nifty);
  return forecast;
}

/**
 * Attach realized OHLC to any stored forecast whose forecast_date already has a
 * printed daily candle but no actuals yet, so the Accuracy tab stays current.
 */
export async function settleActuals(nifty: Candle[]): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const recent = nifty.slice(-40);
  if (recent.length === 0) return 0;
  const earliest = recent[0]!.datetime.slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("nifty_forecasts")
    .select("id, forecast_date")
    .gte("forecast_date", earliest)
    .is("actual_close", null);
  if (error) throw new Error(`Failed to read pending forecasts: ${error.message}`);

  const byDay = new Map(recent.map((c) => [c.datetime.slice(0, 10), c]));
  let settled = 0;
  for (const row of data ?? []) {
    const candle = byDay.get(row.forecast_date);
    if (!candle) continue;
    const { error: updateError } = await supabaseAdmin
      .from("nifty_forecasts")
      .update({
        actual_open: round(candle.open),
        actual_high: round(candle.high),
        actual_low: round(candle.low),
        actual_close: round(candle.close),
      })
      .eq("id", row.id);
    if (updateError) throw new Error(`Failed to settle actuals: ${updateError.message}`);
    settled++;
  }
  return settled;
}


export type BackfillResult = { inserted: number; dates: string[] };

/**
 * Recompute forecasts for every trading day whose *forecast date* falls in
 * [fromISO, toISO], using only data available up to the prior close, and
 * attach the actual OHLC that was printed on the forecast date.
 */
export async function backfillForecasts(
  fromISO: string,
  toISO: string,
): Promise<BackfillResult> {
  const apiKey = process.env["ANGEL_API_KEY"];
  const clientId = process.env["ANGEL_CLIENT_ID"];
  const password = process.env["ANGEL_CLIENT_PASSWORD"];
  const totpSecret = process.env["ANGEL_TOTP_SECRET"];
  if (!apiKey || !clientId || !password || !totpSecret) {
    throw new Error("Missing Angel One credentials");
  }

  const jwt = await login({ apiKey, clientId, password, totpSecret });
  const nifty = await fetchDailyCandles({
    jwt,
    historicalApiKey: apiKey,
    exchange: "NSE",
    symbolToken: "99926000",
    name: "NIFTY_50",
  });
  await new Promise((r) => setTimeout(r, 3000));
  const vix = await fetchDailyCandles({
    jwt,
    historicalApiKey: apiKey,
    exchange: "NSE",
    symbolToken: "99926017",
    name: "INDIA_VIX",
  });

  const day = (c: Candle) => c.datetime.slice(0, 10);
  const rows: (Forecast & {
    actual_open: number;
    actual_high: number;
    actual_low: number;
    actual_close: number;
  })[] = [];

  for (let i = 31; i < nifty.length; i++) {
    const target = nifty[i]!;
    const targetDay = day(target);
    if (targetDay < fromISO || targetDay > toISO) continue;

    const priorNifty = nifty.slice(0, i);
    const asOf = day(priorNifty[priorNifty.length - 1]!);
    const priorVix = vix.filter((c) => day(c) <= asOf);
    if (priorVix.length === 0) continue;

    const forecast = buildForecast(priorNifty, priorVix);
    rows.push({
      ...forecast,
      forecast_date: targetDay,
      actual_open: round(target.open),
      actual_high: round(target.high),
      actual_low: round(target.low),
      actual_close: round(target.close),
    });
  }

  if (rows.length === 0) return { inserted: 0, dates: [] };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("nifty_forecasts")
    .upsert(rows, { onConflict: "forecast_date" });
  if (error) throw new Error(`Failed to save backfill: ${error.message}`);

  return { inserted: rows.length, dates: rows.map((r) => r.forecast_date) };
}
