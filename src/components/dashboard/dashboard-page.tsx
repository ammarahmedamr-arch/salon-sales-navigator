import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileSpreadsheet,
  HelpCircle,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-crm";
import { LogContactDialog } from "@/components/clients/log-contact-dialog";
import { buildWhatsAppUrl, formatArabicDate } from "@/lib/utils";
import type { Client } from "@/lib/types";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading, isError } = useDashboardStats();
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedClientForLog, setSelectedClientForLog] = useState<Client | null>(null);

  const openLogForClient = (client: Client) => {
    setSelectedClientForLog(client);
    setLogDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
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

  // Real empty state when DB has 0 clients
  if (stats.total === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">لوحة المتابعة</h1>
            <p className="text-sm text-muted-foreground">نظرة عامة على أداء التواصل مع الصالونات</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 p-16 text-center shadow-xs">
          <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="size-8" />
          </div>
          <h2 className="mt-6 text-xl font-bold">لا يوجد صالونات مسجلة بعد</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            ابدأ رحلة المبيعات بإضافة أول صالون أو استيراد الصالونات وقائمة العملاء السابقة من ملف Excel.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => navigate({ to: "/clients" })}
              className="h-10 gap-2 rounded-xl"
            >
              <Plus className="size-4" />
              إضافة عميل جديد
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/settings" })}
              className="h-10 gap-2 rounded-xl"
            >
              <FileSpreadsheet className="size-4" />
              تعليمات الاستيراد
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: "إجمالي العملاء",
      value: stats.total,
      description: "جميع الصالونات المسجلة",
      href: "/clients",
      icon: Users,
      badgeColor: "bg-muted text-muted-foreground",
    },
    {
      title: "تم التواصل",
      value: stats.contacted,
      description: `${Math.round((stats.contacted / stats.total) * 100)}% من الإجمالي`,
      href: "/clients",
      icon: Send,
      badgeColor: "bg-primary/10 text-primary",
    },
    {
      title: "ردّ الصالون",
      value: stats.replied,
      description: stats.contacted > 0 ? `${Math.round((stats.replied / stats.contacted) * 100)}% معدل الاستجابة` : "0%",
      href: "/clients",
      icon: MessageSquare,
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      title: "صالونات مهتمة",
      value: stats.interested,
      description: "فرص بيع نشطة",
      href: "/clients",
      icon: Sparkles,
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "متابعات مستحقة",
      value: stats.due,
      description: "مستحقة اليوم أو متأخرة",
      href: "/today",
      icon: Clock,
      badgeColor: stats.due > 0 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold" : "bg-muted text-muted-foreground",
    },
    {
      title: "عروض وتجارب",
      value: stats.demos,
      description: "طلبوا عرض سعر أو ديمو",
      href: "/clients",
      icon: TrendingUp,
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    {
      title: "مشتركون",
      value: stats.subscribed,
      description: "صفقات منجزة بنجاح",
      href: "/clients",
      icon: CheckCircle2,
      badgeColor: "bg-accent/30 text-accent-foreground font-bold",
    },
    {
      title: "غير مهتمين",
      value: stats.notInterested,
      description: "تم استبعادهم حاليًا",
      href: "/clients",
      icon: HelpCircle,
      badgeColor: "bg-muted text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">لوحة المتابعة</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            متابعة فورية لنتائج التواصل ومؤشرات أداء فريق المبيعات
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setSelectedClientForLog(null);
              setLogDialogOpen(true);
            }}
            className="h-10 gap-2 rounded-xl shadow-xs"
          >
            <Plus className="size-4" />
            تسجيل تواصل جديد
          </Button>
        </div>
      </div>

      {/* 8 KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.title}
              to={kpi.href}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{kpi.title}</span>
                <span className={`grid size-7 place-items-center rounded-lg ${kpi.badgeColor}`}>
                  <Icon className="size-3.5" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight">{kpi.value}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{kpi.description}</p>
            </Link>
          );
        })}
      </div>

      {/* Sales Funnel & City Distribution Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Funnel Card */}
        <Card className="rounded-2xl border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">قمع المبيعات ومراحل التحويل</CardTitle>
                <CardDescription className="text-xs">
                  تدرج الصالونات من أول تواصل حتى الاشتراك الفعلي
                </CardDescription>
              </div>
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {stats.funnel.map((step) => {
              const maxCount = Math.max(stats.total, 1);
              const pct = Math.round((step.count / maxCount) * 100);
              return (
                <div key={step.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground">{step.label}</span>
                    <span className="text-muted-foreground">
                      {step.count} صالون ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: step.fill,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* City Distribution Card */}
        <Card className="rounded-2xl border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">توزيع المدن</CardTitle>
                <CardDescription className="text-xs">الصالونات حسب المنطقة</CardDescription>
              </div>
              <MapPin className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-2">
            {stats.cities.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">لا توجد بيانات مدن بعد</p>
            ) : (
              stats.cities.slice(0, 6).map((city) => {
                const cityPct = Math.round((city.value / Math.max(stats.total, 1)) * 100);
                return (
                  <div key={city.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary" />
                      <span className="font-medium text-foreground">{city.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{city.value} صالون</span>
                      <span className="text-[11px] font-semibold text-primary/80">({cityPct}%)</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two Columns: Top Follow-ups & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top 5 Follow-ups (Due Today / Overdue) */}
        <Card className="rounded-2xl border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Clock className="size-4 text-amber-500" />
                  أهم المتابعات المطلوبة
                </CardTitle>
                <CardDescription className="text-xs">
                  الصالونات ذات الأولوية الأعلى التي تحتاج متابعة
                </CardDescription>
              </div>
              <Link to="/today" className="text-xs font-semibold text-primary hover:underline">
                عرض الكل
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-1">
            {stats.followUps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="size-8 text-emerald-500" />
                <p className="mt-2 text-xs font-semibold text-foreground">
                  رائع! لا توجد متابعات متأخرة اليوم
                </p>
                <p className="text-[11px] text-muted-foreground">جميع المتابعات محدثة</p>
              </div>
            ) : (
              stats.followUps.map((client) => {
                const waUrl = buildWhatsAppUrl(client.phone, `مرحبًا ${client.name}، نود متابعة تواصلنا معكم.`);
                const isOverdue = client.follow_up_state === "متأخرة";
                return (
                  <div
                    key={client.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/clients"
                          search={{ q: client.code, page: 1 }}
                          className="truncate text-sm font-bold text-foreground hover:text-primary"
                        >
                          {client.name}
                        </Link>
                        <Badge
                          variant={client.priority === "عالية" ? "destructive" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
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
                          {isOverdue ? "متأخرة" : "مستحقة اليوم"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {client.code} · {client.city} · {client.next_follow_up_date || "اليوم"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20"
                        title="محادثة واتساب"
                      >
                        <MessageSquare className="size-4" />
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openLogForClient(client)}
                        className="h-8 rounded-lg text-xs"
                      >
                        تسجيل
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Stream */}
        <Card className="rounded-2xl border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Activity className="size-4 text-primary" />
                  آخر عمليات التواصل
                </CardTitle>
                <CardDescription className="text-xs">
                  سجل المحاولات والمحادثات الأخيرة للفريق
                </CardDescription>
              </div>
              <Link to="/log" className="text-xs font-semibold text-primary hover:underline">
                عرض السجل الكامل
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-1">
            {(!stats.recentLogs || stats.recentLogs.length === 0) ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                لم يتم تسجيل أي تواصل بعد
              </p>
            ) : (
              stats.recentLogs.slice(0, 5).map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-bold text-foreground">
                        {log.client_name || "صالون"}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {log.channel}
                      </span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {log.result}
                      </span>
                    </div>
                    {log.reply_summary && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {log.reply_summary}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatArabicDate(log.contacted_at)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log Contact Dialog */}
      <LogContactDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        client={selectedClientForLog}
      />
    </div>
  );
}
