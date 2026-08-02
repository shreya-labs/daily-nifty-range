import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/backfill-forecasts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let from = url.searchParams.get("from") ?? "";
          let to = url.searchParams.get("to") ?? "";
          if (!from || !to) {
            const body = (await request.json().catch(() => ({}))) as {
              from?: string;
              to?: string;
            };
            from = from || body.from || "";
            to = to || body.to || "";
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
            return Response.json(
              { success: false, error: "from/to must be YYYY-MM-DD" },
              { status: 400 },
            );
          }

          const { backfillForecasts } = await import("@/lib/forecast.server");
          const result = await backfillForecasts(from, to);
          return Response.json({ success: true, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("Backfill job failed:", message);
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
