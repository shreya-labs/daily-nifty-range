import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-forecast")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runAndStoreForecast } = await import("@/lib/forecast.server");
          const forecast = await runAndStoreForecast();
          return Response.json({ success: true, forecast });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("Daily forecast job failed:", message);
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
