import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/today")({
  component: () => <div className="page-content"><p className="text-muted-foreground text-sm">متابعات اليوم — قريبًا</p></div>,
});

