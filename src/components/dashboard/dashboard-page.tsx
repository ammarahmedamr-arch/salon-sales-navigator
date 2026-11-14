import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  KeyRound,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  Send,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats, useTeamUsers, useClients } from "@/hooks/use-crm";
import { LogContactDialog } from "@/components/clients/log-contact-dialog";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ImportExcelDialog } from "@/components/clients/import-excel-dialog";
import { buildWhatsAppUrl, computeFollowUpState } from "@/lib/utils";
import type { AppUser, Client } from "@/lib/types";

interface DashboardPageProps {
  user: AppUser;
}

export function DashboardPage({ user }: DashboardPageProps) {
  const navigate = useNavigate();
  const isAdmin = user.role === "admin";

  const { data: stats, isLoading, isError } = useDashboardStats();
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

  // 1. Calculations for Agent view
  const myClients = clients.filter(
    (c) => c.owner === user.id || c.owner === user.name
  );
  const myContactedCount = myClients.filter((c) => c.contact_status !== "لم يتم التواصل").length;
  const mySubscribedCount = myClients.filter((c) => c.outcome === "مشترك").length;

  const myFollowUps = myClients.filter(
    (c) => c.next_follow_up_date && !["مشترك", "غير مهتم", "لا يرغب بالتواصل"].includes(c.outcome)
  );
  const myDueOverdueFollowUps = myFollowUps.filter((c) => {
    const s = computeFollowUpState(c.next_follow_up_date, c.outcome);
    return s === "مستحقة" || s === "متأخرة";
  });
  const myDueTodayCount = myDueOverdueFollowUps.length;

  // New salons assigned to this agent that have not been contacted yet
  const myNewSalons = myClients.filter((c) => c.contact_status === "لم يتم التواصل");

  // 2. Calculations for Admin view & Unassigned Pool
  const unassignedClients = clients.filter((c) => !c.owner || c.owner.trim() === "");
  const unassignedCount = unassignedClients.length;
  const totalSalons = stats.total;
  const contactedCount = stats.contacted;
  const subscribedCount = stats.subscribed;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Quick Actions */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-gradient-to-b from-card to-card/60 p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              {isAdmin ? <Building2 className="size-5" /> : <Sparkles className="size-5" />}
            </span>
            <h1 className="text-2xl font-bold tracking-tight">
              {isAdmin ? "لوحة تحكم إدارة المبيعات" : `مرحبًا بك، ${user.name} 👋`}
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {isAdmin
              ? "متابعة أداء المبيعات، استيراد الصالونات، وتوزيع المهام على الفريق"
              : "لوحة متابعاتك اليومية — الصالونات المسندة إليك والمطلوب إنجازه اليوم"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <Button
              onClick={() => setImportExcelOpen(true)}
              className="h-10 gap-2 rounded-xl bg-emerald-600 font-semibold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              <FileSpreadsheet className="size-4" />
              استيراد من Excel
            </Button>
          )}

          <Button
            onClick={() => {
              setSelectedClientForLog(null);
              setLogDialogOpen(true);
            }}
            className="h-10 gap-2 rounded-xl shadow-xs font-semibold"
          >
            <PhoneCall className="size-4" />
            تسجيل تواصل
          </Button>

          <Button
            onClick={() => setClientFormOpen(true)}
            variant="outline"
            className="h-10 gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/5"
          >
            <Plus className="size-4" />
            إضافة صالون
          </Button>

          {!isAdmin && unassignedCount > 0 && (
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/clients", search: { owner: "none" } })}
              className="h-10 gap-2 rounded-xl border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            >
              <UserPlus className="size-4" />
              استلام صالونات ({unassignedCount})
            </Button>
          )}
        </div>
      </div>

      {/* 2. Key Metrics Cards (Different for Admin vs Agent) */}
      {isAdmin ? (
        /* ADMIN METRICS */
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
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
            <p className="mt-1 text-[11px] text-muted-foreground">جميع الصالونات بالنظام</p>
          </Link>

          <Link
            to="/clients"
            search={{ owner: "none" }}
            className={`group relative overflow-hidden rounded-2xl border p-4 transition-all hover:shadow-md ${
              unassignedCount > 0
                ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">غير مخصصة</span>
              <span
                className={`grid size-8 place-items-center rounded-xl ${
                  unassignedCount > 0
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <UserCheck className="size-4" />
              </span>
            </div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-amber-700 dark:text-amber-400">
              {unassignedCount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">صالونات بانتظار التوزيع</p>
          </Link>

          <Link
            to="/clients"
            search={{ status: "تم التواصل" }}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:border-blue-500/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">تم التواصل معها</span>
              <span className="grid size-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
                <PhoneCall className="size-4" />
              </span>
            </div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-blue-600">
              {contactedCount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {totalSalons > 0 ? `${Math.round((contactedCount / totalSalons) * 100)}% تغطية` : "0%"}
            </p>
          </Link>

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
            <p className="mt-1 text-[11px] font-semibold text-emerald-600">صفقات مغلقة 🎉</p>
          </Link>
        </div>
      ) : (
        /* AGENT METRICS (Personal Performance) */
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <Link
            to="/today"
            className={`group relative overflow-hidden rounded-2xl border p-4 transition-all hover:shadow-md ${
              myDueTodayCount > 0
                ? "border-amber-500/50 bg-amber-500/5 hover:border-amber-500"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">مطلوب متابعته اليوم</span>
              <span
                className={`grid size-8 place-items-center rounded-xl ${
                  myDueTodayCount > 0
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Clock className="size-4" />
              </span>
            </div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
              {myDueTodayCount}
            </div>
            <p className="mt-1 text-[11px] font-semibold text-amber-600">
              {myDueTodayCount > 0 ? "متابعات مستحقة أو متأخرة" : "لا توجد متابعات متأخرة"}
            </p>
          </Link>

          <Link
            to="/clients"
            search={{ owner: user.id }}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">صالوناتي المسندة</span>
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </span>
            </div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
              {myClients.length}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">صالونات تحت مسؤوليتك</p>
          </Link>

          <Link
            to="/clients"
            search={{ owner: user.id, status: "تم التواصل" }}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:border-blue-500/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">تواصلت معها</span>
              <span className="grid size-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
                <PhoneCall className="size-4" />
              </span>
            </div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-blue-600">
              {myContactedCount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {myClients.length > 0
                ? `${Math.round((myContactedCount / myClients.length) * 100)}% من صالوناتك`
                : "0%"}
            </p>
          </Link>

          <Link
            to="/clients"
            search={{ owner: user.id, outcome: "مشترك" }}
            className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-card p-4 transition-all hover:border-emerald-500/60 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">مشتركون حققتهم</span>
              <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
              </span>
            </div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
              {mySubscribedCount}
            </div>
            <p className="mt-1 text-[11px] font-semibold text-emerald-600">صالونات تم إغلاقها 🎉</p>
          </Link>
        </div>
      )}

      {/* 3. Fast Indicators Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-5 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <Link to="/today" className="flex items-center gap-1.5 hover:text-primary">
            <Clock className="size-3.5 text-amber-500" />
            <span>متابعات اليوم:</span>
            <Badge variant="secondary" className="font-bold text-amber-600">
              {isAdmin ? stats.due : myDueTodayCount}
            </Badge>
          </Link>

          {!isAdmin && (
            <Link
              to="/clients"
              search={{ owner: user.id, status: "لم يتم التواصل" }}
              className="flex items-center gap-1.5 hover:text-primary"
            >
              <Phone className="size-3.5 text-blue-500" />
              <span>صالونات جديدة تحتاج أول اتصال:</span>
              <Badge variant="secondary">{myNewSalons.length}</Badge>
            </Link>
          )}

          {isAdmin && (
            <Link to="/clients" search={{ status: "في انتظار الرد" }} className="flex items-center gap-1.5 hover:text-primary">
              <MessageSquare className="size-3.5 text-blue-500" />
              <span>بانتظار الرد:</span>
              <Badge variant="secondary">{Math.max(0, stats.contacted - stats.replied)}</Badge>
            </Link>
          )}
        </div>

        <Link
          to="/clients"
          search={isAdmin ? {} : { owner: user.id }}
          className="flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          <span>{isAdmin ? `عرض جدول الصالونات (${totalSalons})` : `عرض صالوناتي (${myClients.length})`}</span>
          <ChevronLeftIcon className="size-3.5" />
        </Link>
      </div>

      {/* 4. Actionable Priority Follow-ups */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-600" />
            <h2 className="text-lg font-bold">
              {isAdmin ? "صالونات تحتاج متابعة اليوم" : "المطلوب منك اليوم (متابعاتك المستحقة)"}
            </h2>
          </div>
          <Link
            to="/today"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>عرض جدول المتابعات الكامل</span>
            <ChevronLeftIcon className="size-3.5" />
          </Link>
        </div>

        {/* Determine which list of follow-ups to display */}
        {(() => {
          const displayedFollowUps = isAdmin
            ? stats.followUps || []
            : myDueOverdueFollowUps;

          if (displayedFollowUps.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="size-8 text-emerald-500" />
                <p className="mt-2 font-bold text-foreground">
                  {isAdmin
                    ? "رائع! لا توجد متابعات متأخرة أو مستحقة اليوم في النظام"
                    : `رائع يا ${user.name}! أنجزت جميع متابعاتك المستحقة اليوم 🎉`}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {isAdmin
                    ? "يمكنك استيراد صالونات جديدة وتوزيعها لبدء جولة تواصل جديدة."
                    : "ابدأ بالتواصل مع صالوناتك المسندة الجديدة أو استلم صالونات من قسم غير المخصص."}
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {displayedFollowUps.slice(0, 9).map((client) => {
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
                        {isAdmin && client.owner_name && (
                          <p className="font-semibold text-primary">المسؤول: {client.owner_name}</p>
                        )}
                        {client.notes && (
                          <p className="line-clamp-2 rounded-lg bg-muted/40 p-1.5 text-[11px] text-foreground">
                            💬 {client.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 1-Click Action Bar */}
                    <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                      <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex-1">
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
                        className="h-8 gap-1.5 rounded-xl text-xs font-semibold"
                      >
                        <PhoneCall className="size-3.5" />
                        تسجيل النتيجة
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* 5. FOR AGENT: New Salons Waiting For First Call */}
      {!isAdmin && myNewSalons.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="size-5 text-blue-600" />
              <h2 className="text-lg font-bold">صالوناتك المسندة (تحتاج أول تواصل)</h2>
              <Badge variant="secondary" className="text-xs">
                {myNewSalons.length} صالون
              </Badge>
            </div>
            <Link
              to="/clients"
              search={{ owner: user.id, status: "لم يتم التواصل" }}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <span>عرض الكل</span>
              <ChevronLeftIcon className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myNewSalons.slice(0, 6).map((client) => {
              const waLink = buildWhatsAppUrl(
                client.phone,
                `السلام عليكم ${client.contact_person ? "أ / " + client.contact_person : ""}، معك ${user.name} من شركة OJLinker بخصوص خدمات صالون ${client.name}.`
              );

              return (
                <div
                  key={client.id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/40"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{client.code}</span>
                        <h4 className="mt-1 font-bold text-foreground">{client.name}</h4>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {client.business_type}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>📍 {client.city} {client.contact_person ? `• ${client.contact_person}` : ""}</p>
                      <p className="dir-ltr text-start font-mono">{client.phone}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                    <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex-1">
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
                      className="h-8 gap-1.5 rounded-xl text-xs font-semibold"
                    >
                      <PhoneCall className="size-3.5" />
                      بدء التواصل
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. FOR ADMIN: Link to Team Settings */}
      {isAdmin && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-border bg-card p-6 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">بيانات دخول وحسابات فريق المبيعات</h3>
              <p className="text-xs text-muted-foreground">
                تم نقل إدارة حسابات الموظفين وكلمات المرور والصلاحيات إلى صفحة الإعدادات لسهولة التحكم والخصوصية
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate({ to: "/settings" })}
            className="h-10 gap-2 rounded-xl text-xs font-semibold"
          >
            <span>إدارة الفريق في الإعدادات</span>
            <ChevronLeftIcon className="size-3.5" />
          </Button>
        </div>
      )}

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
