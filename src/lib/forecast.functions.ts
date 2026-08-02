import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ForecastRecord =
  Database["public"]["Tables"]["nifty_forecasts"]["Row"];

export const getForecasts = createServerFn({ method: "GET" }).handler(
  async (): Promise<ForecastRecord[]> => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data, error } = await client
      .from("nifty_forecasts")
      .select("*")
      .order("forecast_date", { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);
    return data ?? [];
  },
);
