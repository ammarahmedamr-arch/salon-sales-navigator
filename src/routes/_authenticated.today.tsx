import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  MessageSquare,
  Phone,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients } from "@/hooks/use-crm";
import { LogContactDialog } from "@/components/clients/log-contact-dialog";
import { ClientSheet } from "@/components/clients/client-sheet";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { buildWhatsAppUrl, computeFollowUpState, getRiyadhDateKey } from "@/lib/utils";
import type { Client } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/today")({
  component: TodayFollowUpsPage,
});

function TodayFollowUpsPage() {
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showLater, setShowLater] = useState(false);

  const authContext = Route.useRouteContext() as any;
  const isAdmin = authContext?.user?.role === "admin";

  const { data, isLoading } = useClients({ perPage: 500 });
  const allClients = data?.items ?? [];

  const today = getRiyadhDateKey();

  // Filter clients requiring follow-up
  const activeFollowUps = allClients.filter(
    (c) =>
      c.next_follow_up_date &&
      !["مشترك", "غير مهتم", "لا يرغب بالتواصل"].includes(c.outcome)
  );

  const overdueClients = activeFollowUps
    .filter((c) => computeFollowUpState(c.next_follow_up_date, c.outcome) === "متأخرة")
    .sort((a, b) => (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? ""));

  const dueTodayClients = activeFollowUps
    .filter((c) => computeFollowUpState(c.next_follow_up_date, c.outcome) === "مستحقة")
    .sort((a, b) => {
      const pRank: Record<string, number> = { عالية: 0, متوسطة: 1, منخفضة: 2 };
      return (pRank[a.priority] ?? 1) - (pRank[b.priority] ?? 1);
    });

  const laterClients = activeFollowUps
    .filter((c) => computeFollowUpState(c.next_follow_up_date, c.outcome) === "لاحقًا")
    .sort((a, b) => (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? ""));

  const handleOpenLog = (client: Client) => {
    setSelectedClient(client);
    setLogDialogOpen(true);
  };

  const handleOpenSheet = (client: Client) => {
    setSelectedClient(client);
    setSheetOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setSelectedClient(client);
    setFormDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const renderFollowUpCard = (client: Client, stateLabel: string, isOverdue: boolean) => {
    const waUrl = buildWhatsAppUrl(
      client.phone,
      `مرحبًا ${client.name}، نود متابعة ما اتفقنا عليه بخصوص OJLinker.`
    );

    return (
      <div
        key={client.id}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xs sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              onClick={() => handleOpenSheet(client)}
              className="cursor-pointer font-bold text-foreground text-base hover:text-primary"
            >
              {client.name}
            </span>
            <Badge
              variant={client.priority === "عالية" ? "destructive" : "secondary"}
              className="text-[10px]"
            >
              {client.priority}
            </Badge>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                isOverdue
                  ? "bg-destructive/15 text-destructive"
                  : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
              }`}
            >
              {stateLabel}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
              {client.contact_status}
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {client.outcome}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {client.code} · {client.city} · {client.business_type}
            {client.contact_person ? ` · المسؤول: ${client.contact_person}` : ""}
          </p>

          {client.notes && (
            <p className="line-clamp-1 text-xs text-foreground/80 pt-0.5">
              ملاحظة: {client.notes}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
            <Calendar className="size-3" />
            <span>الموعد: {client.next_follow_up_date}</span>
            {client.last_contact_at && (
              <>
                <span>·</span>
                <span>آخر تواصل: {client.last_contact_at.slice(0, 10)}</span>
              </>
            )}
          </div>
        </div>

        {/* Quick Action buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
          >
            <MessageSquare className="size-4" />
            واتساب
          </a>

          <a
            href={`tel:${client.phone}`}
            className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-xs transition-colors hover:bg-muted"
            title="اتصال هاتفي"
          >
            <Phone className="size-4" />
          </a>

          <Button
            size="sm"
            onClick={() => handleOpenLog(client)}
            className="h-9 gap-1.5 rounded-xl text-xs"
          >
            <Plus className="size-3.5" />
            تسجيل تواصل
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleOpenSheet(client)}
            className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
            title="عرض التفاصيل"
          >
            <Eye className="size-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">متابعات اليوم</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          قائمة المهام والتواصل المجدول حسب توقيت الرياض ({today})
        </p>
      </div>

      {/* Section 1: Overdue Follow-ups */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            <h2 className="text-base font-bold text-foreground">
              متابعات متأخرة
            </h2>
            <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-xs">
              {overdueClients.length}
            </Badge>
          </div>
        </div>

        {overdueClients.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 p-4 text-xs text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-500" />
            ممتاز! لا توجد متابعات متأخرة من الأيام السابقة.
          </div>
        ) : (
          <div className="space-y-2.5">
            {overdueClients.map((c) => renderFollowUpCard(c, "متأخرة", true))}
          </div>
        )}
      </div>

      {/* Section 2: Due Today */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-500" />
            <h2 className="text-base font-bold text-foreground">
              مستحقة اليوم
            </h2>
            <Badge className="rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border-none px-2 py-0.5 text-xs">
              {dueTodayClients.length}
            </Badge>
          </div>
        </div>

        {dueTodayClients.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 p-4 text-xs text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-500" />
            لا توجد متابعات مجدولة لهذا اليوم.
          </div>
        ) : (
          <div className="space-y-2.5">
            {dueTodayClients.map((c) => renderFollowUpCard(c, "مستحقة اليوم", false))}
          </div>
        )}
      </div>

      {/* Section 3: Later / Upcoming (Collapsible) */}
      <div className="space-y-3 pt-2">
        <button
          type="button"
          onClick={() => setShowLater(!showLater)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/40 p-3 text-start transition-colors hover:bg-muted"
        >
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">متابعات قادمة لاحقًا</span>
            <Badge variant="secondary" className="text-xs">
              {laterClients.length}
            </Badge>
          </div>
          {showLater ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>

        {showLater && (
          <div className="space-y-2.5">
            {laterClients.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                لا توجد مواعيد متابعة مجدولة في المستقبل القريب.
              </p>
            ) : (
              laterClients.map((c) => renderFollowUpCard(c, "لاحقًا", false))
            )}
          </div>
        )}
      </div>

      {/* Dialogs & Sheet */}
      <LogContactDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        client={selectedClient}
      />

      <ClientFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        client={selectedClient}
      />

      <ClientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        client={selectedClient}
        onEdit={(c) => {
          setSheetOpen(false);
          handleOpenEdit(c);
        }}
        onLogContact={(c) => {
          setSheetOpen(false);
          handleOpenLog(c);
        }}
        isAdmin={isAdmin}
      />
    </div>
  );
}
