import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/settings")({
  component: () => <div className="page-content"><p className="text-muted-foreground text-sm">الإعدادات — قريبًا</p></div>,
});

