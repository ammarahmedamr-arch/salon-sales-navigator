import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/clients")({
  component: () => <div className="page-content"><p className="text-muted-foreground text-sm">العملاء — قريبًا</p></div>,
});

