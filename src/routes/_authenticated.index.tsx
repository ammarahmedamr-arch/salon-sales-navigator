import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import type { AppUser } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardRoute,
});

function DashboardRoute() {
  const { user } = Route.useRouteContext() as { user: AppUser };
  return <DashboardPage user={user} />;
}
