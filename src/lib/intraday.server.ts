import { login, type Candle } from "@/lib/angel.server";

export type IntradayBar = {
  time: string; // HH:MM (IST)
  open: number;
  high: number;
  low: number;
  close: number;
};

/**
 * Read-only: fetch the 5-minute NIFTY 50 candles for one trading date.
 * Writes nothing to the database.
 */
export async function fetchFiveMinuteBars(dateISO: string): Promise<IntradayBar[]> {
  const apiKey = process.env["ANGEL_API_KEY"];
  const clientId = process.env["ANGEL_CLIENT_ID"];
  const password = process.env["ANGEL_CLIENT_PASSWORD"];
  const totpSecret = process.env["ANGEL_TOTP_SECRET"];
  if (!apiKey || !clientId || !password || !totpSecret) {
    throw new Error("Missing Angel One credentials");
  }

  const jwt = await login({ apiKey, clientId, password, totpSecret });
  const { requestIntradayCandles } = await import("@/lib/angel.server");

  const bars: Candle[] = await requestIntradayCandles({
    jwt,
    historicalApiKey: apiKey,
    exchange: "NSE",
    symbolToken: "99926000",
    name: "NIFTY_50",
    interval: "FIVE_MINUTE",
    fromdate: `${dateISO} 09:00`,
    todate: `${dateISO} 15:45`,
  });

  const sameDay = bars.filter((b) => b.datetime.slice(0, 10) === dateISO);
  if (sameDay.length === 0) {
    throw new Error(`No 5-minute NIFTY candles for ${dateISO}.`);
  }

  return sameDay.map((b) => ({
    time: b.datetime.slice(11, 16),
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  }));
}
