import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/log")({
  component: () => <div className="page-content"><p className="text-muted-foreground text-sm">سجل التواصل — قريبًا</p></div>,
});

