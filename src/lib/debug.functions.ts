import { createServerFn } from "@tanstack/react-start";

export const runForecastForDate = createServerFn({ method: "POST" })
  .inputValidator((input: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new Error("Date must be YYYY-MM-DD");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{ inserted: number; dates: string[] }> => {
    const { backfillForecasts } = await import("@/lib/forecast.server");
    return backfillForecasts(data.date, data.date);
  });

export const runTodayForecast = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ forecast_date: string; as_of_date: string }> => {
    const { runAndStoreForecast } = await import("@/lib/forecast.server");
    const forecast = await runAndStoreForecast();
    return { forecast_date: forecast.forecast_date, as_of_date: forecast.as_of_date };
  },
);
