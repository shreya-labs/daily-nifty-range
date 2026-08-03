// Angel One SmartAPI client (server-only).
// Mirrors auth.py + download_nifty_vix_daily.py using plain fetch + Web Crypto.

const BASE = "https://apiconnect.angelone.in";

export type Candle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function base32Decode(input: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) throw new Error("Invalid TOTP secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export async function generateTotp(secret: string, timeStepSeconds = 30): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const counter = Math.floor(Date.now() / 1000 / timeStepSeconds);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const offset = sig[sig.length - 1]! & 0x0f;
  const code =
    (((sig[offset]! & 0x7f) << 24) |
      ((sig[offset + 1]! & 0xff) << 16) |
      ((sig[offset + 2]! & 0xff) << 8) |
      (sig[offset + 3]! & 0xff)) %
    1_000_000;
  return code.toString().padStart(6, "0");
}

function baseHeaders(privateKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": privateKey,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function login(config: {
  apiKey: string;
  clientId: string;
  password: string;
  totpSecret: string;
}): Promise<string> {
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const totp = await generateTotp(config.totpSecret);
      const res = await fetch(
        `${BASE}/rest/auth/angelbroking/user/v1/loginByPassword`,
        {
          method: "POST",
          headers: baseHeaders(config.apiKey),
          body: JSON.stringify({
            clientcode: config.clientId,
            password: config.password,
            totp,
          }),
        },
      );
      const json = (await res.json()) as {
        status?: boolean;
        message?: string;
        data?: { jwtToken?: string };
      };
      if (json?.status && json.data?.jwtToken) {
        return json.data.jwtToken.replace(/^Bearer\s+/i, "");
      }
      lastError = json?.message ?? `HTTP ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) await sleep(2 ** attempt * 1000);
  }
  throw new Error(`SmartAPI login failed after 3 attempts: ${lastError}`);
}

function isRateLimit(message: string): boolean {
  const m = message.toLowerCase();
  return ["access rate", "rate limit", "too many requests", "exceeding access", "429"].some(
    (marker) => m.includes(marker),
  );
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export async function fetchDailyCandles(params: {
  jwt: string;
  historicalApiKey: string;
  exchange: string;
  symbolToken: string;
  name: string;
}): Promise<Candle[]> {
  // Window ends at "today" in IST so the session that just closed is included.
  const end = new Date(Date.now() + IST_OFFSET_MS);
  const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
  const payload = {
    exchange: params.exchange,
    symboltoken: params.symbolToken,
    interval: "ONE_DAY",
    fromdate: `${formatDate(start)} 00:00`,
    todate: `${formatDate(end)} 23:59`,
  };

  const delays = [2, 4, 8, 16, 32];
  let lastError = "unknown error";
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(
        `${BASE}/rest/secure/angelbroking/historical/v1/getCandleData`,
        {
          method: "POST",
          headers: {
            ...baseHeaders(params.historicalApiKey),
            Authorization: `Bearer ${params.jwt}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json()) as {
        status?: boolean;
        message?: string;
        data?: unknown[];
      };
      if (json?.status && Array.isArray(json.data) && json.data.length > 0) {
        return (json.data as unknown[][])
          .map((row) => ({
            datetime: String(row[0]),
            open: Number(row[1]),
            high: Number(row[2]),
            low: Number(row[3]),
            close: Number(row[4]),
            volume: Number(row[5] ?? 0),
          }))
          .filter((c) => [c.open, c.high, c.low, c.close].every(Number.isFinite))
          .sort((a, b) => a.datetime.localeCompare(b.datetime));
      }
      lastError = json?.message ?? `HTTP ${res.status}`;
      if (!isRateLimit(lastError)) {
        throw new Error(`Failed to download ${params.name}: ${lastError}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (!isRateLimit(lastError) || attempt === delays.length) throw error;
    }
    const delay = delays[Math.min(attempt, delays.length - 1)]!;
    await sleep(delay * 1000);
  }
  throw new Error(`Failed to download ${params.name}: ${lastError}`);
}
