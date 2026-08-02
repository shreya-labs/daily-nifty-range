import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";

export type ForecastRecord =
  Database["public"]["Tables"]["nifty_forecasts"]["Row"];

export const getForecasts = createServerFn({ method: "GET" }).handler(
  async (): Promise<ForecastRecord[]> => {
    const { createPublicClient } = await import("@/lib/supabase-public.server");
    const { data, error } = await createPublicClient()
      .from("nifty_forecasts")
      .select("*")
      .order("forecast_date", { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const getForecastHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<ForecastRecord[]> => {
    const { createPublicClient } = await import("@/lib/supabase-public.server");
    const { data, error } = await createPublicClient()
      .from("nifty_forecasts")
      .select("*")
      .order("forecast_date", { ascending: false })
      .limit(400);

    if (error) throw new Error(error.message);
    return data ?? [];
  },
);
