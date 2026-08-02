import { Link, useRouterState } from "@tanstack/react-router";

const tabs = [
  { to: "/", label: "Forecast" },
  { to: "/accuracy", label: "Accuracy" },
] as const;

export function TabNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav className="mt-6 flex gap-1 rounded-lg border border-border bg-secondary/40 p-1 text-sm">
      {tabs.map((tab) => {
        const active = path === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`rounded-md px-4 py-1.5 transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
