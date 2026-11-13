import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useDashboardStats, useTeamUsers, useClients } from "@/hooks/use-crm";
import { LogContactDialog } from "@/components/clients/log-contact-dialog";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ImportExcelDialog } from "@/components/clients/import-excel-dialog";
import { buildWhatsAppUrl } from "@/lib/utils";
import type { Client } from "@/lib/types";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading, isError } = useDashboardStats();
  const { data: teamUsers = [] } = useTeamUsers();
  const { data: allClientsData } = useClients({ perPage: 1000 });

  // Dialog States
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [importExcelOpen, setImportExcelOpen] = useState(false);
  const [selectedClientForLog, setSelectedClientForLog] = useState<Client | null>(null);

  const openLogForClient = (client: Client) => {
    setSelectedClientForLog(client);
    setLogDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 p-12 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <h3 className="mt-3 text-lg font-bold">تعذّر تحميل بيانات لوحة المتابعة</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          تأكد من تشغيل خادم PocketBase وتسجيل الدخول بحساب صحيح.
        </p>
      </div>
    );
  }

  const clients = allClientsData?.items ?? [];

  // Calculate team assignments
  const teamStats = teamUsers.map((user) => {
    const userClients = clients.filter(
      (c) => c.owner === user.id || c.owner === user.name
    );
    const contacted = userClients.filter((c) => c.contact_status !== "لم يتم التواصل").length;
    const subscribed = userClients.filter((c) => c.outcome === "مشترك").length;
    return {
      user,
      total: userClients.length,
      contacted,
      subscribed,
    };
  });

  // Calculate primary simple metrics
  const totalSalons = stats.total;
  const contactedCount = stats.contacted;
  const activeOpportunities = stats.interested + stats.demos;
  const subscribedCount = stats.subscribed;
  const uncontactedCount = Math.max(0, totalSalons - contactedCount);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Big Quick Actions */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-gradient-to-b from-card to-card/60 p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">متابعة مبيعات الصالونات</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            أضف صالونات جديدة، وزّعها على فريق المبيعات، وتابع الاتصالات اليومية بسهولة
          </p>
        </div>

        {/* 3 Prominent Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setImportExcelOpen(true)}
            className="h-10 gap-2 rounded-xl bg-emerald-600 font-semibold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            <FileSpreadsheet className="size-4" />
            استيراد من Excel
          </Button>

          <Button
            onClick={() => setClientFormOpen(true)}
            variant="outline"
            className="h-10 gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/5"
          >
            <Plus className="size-4" />
            إضافة صالون
          </Button>

          <Button
            onClick={() => {
              setSelectedClientForLog(null);
              setLogDialogOpen(true);
            }}
            className="h-10 gap-2 rounded-xl shadow-xs"
          >
            <PhoneCall className="size-4" />
            تسجيل تواصل
          </Button>
        </div>
      </div>

      {/* 2. Simplified 4 Key Metric Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {/* Total Salons */}
        <Link
          to="/clients"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">إجمالي الصالونات</span>
            <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <Users className="size-4" />
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">{totalSalons}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {uncontactedCount > 0 ? `${uncontactedCount} لم يتم التواصل معهم بعد` : "تم بدء التواصل مع الجميع"}
          </p>
        </Link>

        {/* Contacted */}
        <Link
          to="/clients"
          search={{ status: "تم التواصل" }}
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">تم التواصل معهم</span>
            <span className="grid size-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Send className="size-4" />
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400">
            {contactedCount}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totalSalons > 0 ? `${Math.round((contactedCount / totalSalons) * 100)}% معدل التغطية` : "0%"}
          </p>
        </Link>

        {/* Active Opportunities */}
        <Link
          to="/clients"
          search={{ outcome: "مهتم" }}
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">مهتمون وعروض نشطة</span>
            <span className="grid size-8 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="size-4" />
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-purple-600 dark:text-purple-400">
            {activeOpportunities}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {stats.interested} مهتم + {stats.demos} طلبوا ديمو/عرض
          </p>
        </Link>

        {/* Subscribed */}
        <Link
          to="/clients"
          search={{ outcome: "مشترك" }}
          className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-card p-4 transition-all hover:border-emerald-500/60 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">مشتركون بنجاح</span>
            <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
            {subscribedCount}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-emerald-600">
            صفقات تم إغلاقها بنجاح 🎉
          </p>
        </Link>
      </div>

      {/* Secondary Fast Indicators Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-5 py-3 text-xs">
        <div className="flex items-center gap-6">
          <Link to="/today" className="flex items-center gap-1.5 hover:text-primary">
            <Clock className="size-3.5 text-amber-500" />
            <span>متابعات مستحقة اليوم أو متأخرة:</span>
            <Badge variant="secondary" className="font-bold text-amber-600">
              {stats.due}
            </Badge>
          </Link>

          <Link to="/clients" search={{ status: "في انتظار الرد" }} className="flex items-center gap-1.5 hover:text-primary">
            <MessageSquare className="size-3.5 text-blue-500" />
            <span>بانتظار الرد:</span>
            <Badge variant="secondary">{Math.max(0, stats.contacted - stats.replied)}</Badge>
          </Link>

          <Link to="/clients" search={{ outcome: "غير مهتم" }} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <span>غير مهتمين:</span>
            <span>{stats.notInterested}</span>
          </Link>
        </div>

        <Link to="/clients" className="flex items-center gap-1 font-semibold text-primary hover:underline">
          <span>عرض جميع الصالونات ({totalSalons})</span>
          <ChevronLeftIcon className="size-3.5" />
        </Link>
      </div>

      {/* 3. Team Salon Distribution Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <h2 className="text-lg font-bold">توزيع الصالونات على فريق المبيعات</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            توزيع ومتابعة أداء كل مندوب في تغطية الصالونات
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teamStats.map(({ user, total, contacted, subscribed }) => {
            const coveragePercent = total > 0 ? Math.round((contacted / total) * 100) : 0;
            return (
              <div
                key={user.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/30"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-foreground">{user.name}</h3>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                    {user.role === "admin" ? "مدير النظام" : "مسؤول مبيعات"}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-muted/40 p-2">
                    <span className="text-[10px] text-muted-foreground">الصالونات</span>
                    <p className="text-base font-bold">{total}</p>
                  </div>
                  <div className="rounded-xl bg-blue-500/10 p-2">
                    <span className="text-[10px] text-blue-600">تواصل معهم</span>
                    <p className="text-base font-bold text-blue-600">{contacted}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-2">
                    <span className="text-[10px] text-emerald-600">المشتركين</span>
                    <p className="text-base font-bold text-emerald-600">{subscribed}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>نسبة الإنجاز:</span>
                    <span className="font-bold">{coveragePercent}%</span>
                  </div>
                  <Progress value={coveragePercent} className="h-1.5" />
                </div>

                <div className="mt-3 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate({ to: "/clients", search: { q: user.name } })}
                    className="h-8 w-full gap-1.5 rounded-lg text-xs text-primary hover:bg-primary/5"
                  >
                    <span>عرض صالونات {user.name}</span>
                    <ExternalLink className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Actionable Priority Follow-ups for Today */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-600" />
            <h2 className="text-lg font-bold">صالونات تحتاج متابعة اليوم</h2>
          </div>
          <Link
            to="/today"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>عرض جدول المتابعات الكامل</span>
            <ChevronLeftIcon className="size-3.5" />
          </Link>
        </div>

        {stats.followUps && stats.followUps.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.followUps.map((client) => {
              const waLink = buildWhatsAppUrl(
                client.phone,
                `السلام عليكم ${client.contact_person ? "أ / " + client.contact_person : ""}، معك فريق OJLinker بخصوص خدمات صالون ${client.name}.`
              );

              return (
                <div
                  key={client.id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/40"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-muted-foreground">{client.code}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {client.business_type}
                          </Badge>
                        </div>
                        <h4 className="mt-1 font-bold text-foreground">{client.name}</h4>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          client.priority === "عالية"
                            ? "bg-rose-500/10 font-bold text-rose-600"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {client.priority}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>📍 {client.city} {client.contact_person ? `• ${client.contact_person}` : ""}</p>
                      <p className="dir-ltr text-start font-mono">{client.phone}</p>
                      {client.notes && (
                        <p className="line-clamp-2 rounded-lg bg-muted/40 p-1.5 text-[11px] text-foreground">
                          💬 {client.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 1-Click Action Bar */}
                  <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full gap-1.5 rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      >
                        <MessageSquare className="size-3.5" />
                        واتساب
                      </Button>
                    </a>

                    <a href={`tel:${client.phone}`} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full gap-1.5 rounded-xl text-xs"
                      >
                        <Phone className="size-3.5" />
                        اتصال
                      </Button>
                    </a>

                    <Button
                      size="sm"
                      onClick={() => openLogForClient(client)}
                      className="h-8 gap-1.5 rounded-xl text-xs"
                    >
                      <PhoneCall className="size-3.5" />
                      تسجيل النتيجة
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="size-8 text-emerald-500" />
            <p className="mt-2 font-bold text-foreground">رائع! لا توجد متابعات متأخرة أو مستحقة اليوم</p>
            <p className="mt-0.5 text-muted-foreground">
              يمكنك استيراد صالونات جديدة وتوزيعها لبدء جولة تواصل جديدة.
            </p>
          </div>
        )}
      </div>

      {/* 5. Sales Funnel Visual Progress */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-xs">
        <h3 className="text-base font-bold">مسار تحويل المبيعات (Sales Funnel)</h3>
        <p className="text-xs text-muted-foreground">
          رحلة الصالون من الاستيراد وحتى الاشتراك الفعلي
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <span className="text-xs text-muted-foreground">1. إجمالي الصالونات</span>
            <p className="text-lg font-bold">{totalSalons}</p>
            <Progress value={100} className="mt-2 h-1.5" />
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <span className="text-xs text-muted-foreground">2. تم التواصل معهم</span>
            <p className="text-lg font-bold text-blue-600">{contactedCount}</p>
            <Progress
              value={totalSalons > 0 ? (contactedCount / totalSalons) * 100 : 0}
              className="mt-2 h-1.5"
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <span className="text-xs text-muted-foreground">3. مهتمون / عروض</span>
            <p className="text-lg font-bold text-purple-600">{activeOpportunities}</p>
            <Progress
              value={totalSalons > 0 ? (activeOpportunities / totalSalons) * 100 : 0}
              className="mt-2 h-1.5"
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <span className="text-xs text-muted-foreground">4. مشتركون بنجاح</span>
            <p className="text-lg font-bold text-emerald-600">{subscribedCount}</p>
            <Progress
              value={totalSalons > 0 ? (subscribedCount / totalSalons) * 100 : 0}
              className="mt-2 h-1.5"
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <LogContactDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        client={selectedClientForLog}
      />

      <ClientFormDialog
        open={clientFormOpen}
        onOpenChange={setClientFormOpen}
        client={null}
      />

      <ImportExcelDialog
        open={importExcelOpen}
        onOpenChange={setImportExcelOpen}
      />
    </div>
  );
}

function ChevronLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      className="size-4"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
