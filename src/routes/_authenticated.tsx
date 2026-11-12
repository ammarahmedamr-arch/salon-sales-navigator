import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/app-shell";
import type { AppUser } from "@/lib/types";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await api.auth.currentUser();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: AuthenticatedLayout,
});
function AuthenticatedLayout() {
  const { user } = Route.useRouteContext() as { user: AppUser };
  return <AppShell user={user}><Outlet /></AppShell>;
}
