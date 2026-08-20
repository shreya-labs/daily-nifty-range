import { createServerFn } from "@tanstack/react-start";
import type { IntradayBar } from "@/lib/intraday.server";

export type { IntradayBar };

export const getFiveMinuteBars = createServerFn({ method: "POST" })
  .inputValidator((input: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new Error("Date must be YYYY-MM-DD");
    }
    return input;
  })
  .handler(async ({ data }): Promise<IntradayBar[]> => {
    const { fetchFiveMinuteBars } = await import("@/lib/intraday.server");
    return fetchFiveMinuteBars(data.date);
  });
