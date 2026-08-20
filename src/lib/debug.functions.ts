import { createServerFn } from "@tanstack/react-start";
import type { PreviewResult } from "@/lib/forecast.server";

export const previewForecastForDate = createServerFn({ method: "POST" })
  .inputValidator((input: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new Error("Date must be YYYY-MM-DD");
    }
    return input;
  })
  .handler(async ({ data }): Promise<PreviewResult> => {
    const { previewForecast } = await import("@/lib/forecast.server");
    return previewForecast(data.date);
  });

export const previewLatestForecast = createServerFn({ method: "POST" }).handler(
  async (): Promise<PreviewResult> => {
    const { previewForecast } = await import("@/lib/forecast.server");
    return previewForecast();
  },
);
