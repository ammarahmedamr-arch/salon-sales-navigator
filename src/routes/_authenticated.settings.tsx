import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Check,
  Copy,
  Database,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  KeyRound,
  Lock,
  Mail,
  Plus,
  Server,
  Shield,
  Trash2,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { UserFormDialog } from "@/components/settings/user-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClients, useTeamUsers } from "@/hooks/use-crm";
import { api } from "@/lib/api";
import { getRiyadhDateKey } from "@/lib/utils";
import type { AppUser } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function exportToCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapeCell = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent =
    "\uFEFF" +
    [headers.map(escapeCell).join(","), ...rows.map((row) => row.map(escapeCell).join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const authContext = Route.useRouteContext() as any;
  const currentUser: AppUser = authContext?.user;
  const isAdmin = currentUser?.role === "admin";

  const { data: users = [], isLoading: usersLoading } = useTeamUsers();
  const { data: allClientsData } = useClients({ perPage: 1000 });
  const clients = allClientsData?.items ?? [];

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<AppUser | null>(null);
  const [exportingClients, setExportingClients] = useState(false);
  const [exportingLogs, setExportingLogs] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(`تم نسخ ${label}`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const teamStats = users.map((u) => {
    const userClients = clients.filter(
      (c) => c.owner === u.id || c.owner === u.name
    );
    const contacted = userClients.filter((c) => c.contact_status !== "لم يتم التواصل").length;
    const subscribed = userClients.filter((c) => c.outcome === "مشترك").length;
    return {
      user: u,
      total: userClients.length,
      contacted,
      subscribed,
      password: u.role === "admin" ? "AdminSecret123!" : "AgentSecret123!",
    };
  });

  const handleExportClients = async () => {
    setExportingClients(true);
    try {
      const res = await api.clients.list({ perPage: 5000 });
      const clients = res.items;

      const headers = [
        "كود الصالون",
        "اسم الصالون",
        "المدينة",
        "نوع النشاط",
        "اسم المسؤول",
        "رقم الجوال",
        "المصدر",
        "الأولوية",
        "حالة التواصل",
        "النتيجة",
        "آخر تواصل",
        "المتابعة القادمة",
        "ملاحظات",
      ];

      const rows = clients.map((c) => [
        c.code,
        c.name,
        c.city,
        c.business_type,
        c.contact_person,
        c.phone,
        c.source,
        c.priority,
        c.contact_status,
        c.outcome,
        c.last_contact_at,
        c.next_follow_up_date,
        c.notes,
      ]);

      const today = getRiyadhDateKey();
      exportToCsv(`ojlinker_clients_${today}.csv`, headers, rows);
      toast.success(`تم تصدير ${clients.length} صالون بنجاح`);
    } catch (err: any) {
      toast.error("تعذّر تصدير بيانات العملاء");
    } finally {
      setExportingClients(false);
    }
  };

  const handleExportLogs = async () => {
    setExportingLogs(true);
    try {
      const logs = await api.contactLogs.listAll();

      const headers = [
        "كود النشاط",
        "اسم الصالون",
        "تاريخ ووقت التواصل",
        "القناة",
        "نوع المحاولة",
        "رد الصالون",
        "النتيجة",
        "المتابعة القادمة",
        "ملخص الرد",
        "الإجراء القادم",
        "مسؤول التواصل",
      ];

      const rows = logs.map((l) => [
        l.code,
        l.client?.name || "",
        l.contacted_at,
        l.channel,
        l.attempt_type,
        l.replied,
        l.result,
        l.next_follow_up_date,
        l.reply_summary,
        l.next_action,
        l.created_by,
      ]);

      const today = getRiyadhDateKey();
      exportToCsv(`ojlinker_contact_logs_${today}.csv`, headers, rows);
      toast.success(`تم تصدير ${logs.length} سجل تواصل بنجاح`);
    } catch (err: any) {
      toast.error("تعذّر تصدير سجل التواصل");
    } finally {
      setExportingLogs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isAdmin ? "الإعدادات وإدارة النظام" : "إعدادات الحساب"}
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          {isAdmin
            ? "إدارة حسابات فريق المبيعات، الصلاحيات، كلمات المرور، والنسخ الاحتياطي"
            : "معلومات حسابك الشخصي وتحديث كلمة المرور"}
        </p>
      </div>

      {/* ADMIN ONLY: Team Members Credentials & Management */}
      {isAdmin ? (
        <Card className="rounded-3xl border-border shadow-xs">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                بيانات دخول وحسابات فريق المبيعات ({users.length})
              </CardTitle>
              <CardDescription className="text-xs">
                بيانات تسجيل الدخول وكلمات المرور الخاصة بموظفي المبيعات ومتابعة صالونات كل موظف
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setSelectedUserForEdit(null);
                setUserModalOpen(true);
              }}
              className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              إضافة موظف جديد
            </Button>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="overflow-hidden rounded-2xl border border-border">
              <Table dir="rtl">
                <TableHeader className="bg-muted/60 text-muted-foreground">
                  <TableRow>
                    <TableHead className="text-start">الموظف</TableHead>
                    <TableHead className="text-start">البريد الإلكتروني (اسم المستخدم)</TableHead>
                    <TableHead className="text-start">كلمة المرور</TableHead>
                    <TableHead className="text-start">الدور</TableHead>
                    <TableHead className="text-center">الصالونات</TableHead>
                    <TableHead className="text-center">تم التواصل</TableHead>
                    <TableHead className="text-center">مشتركون</TableHead>
                    <TableHead className="text-end">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-xs text-muted-foreground">
                        جارٍ تحميل قائمة الأعضاء...
                      </TableCell>
                    </TableRow>
                  ) : teamStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-xs text-muted-foreground">
                        لا يوجد أعضاء في الفريق حاليًا.
                      </TableCell>
                    </TableRow>
                  ) : (
                    teamStats.map(({ user: u, total, contacted, subscribed, password }) => (
                      <TableRow key={u.id} className="transition-colors hover:bg-muted/20">
                        <TableCell className="font-bold text-xs text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                              {u.name.slice(0, 1)}
                            </span>
                            <span>{u.name}</span>
                            {u.id === currentUser?.id && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                أنت
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-start">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                            <span>{u.email}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6 text-muted-foreground hover:text-foreground"
                              onClick={() => copyToClipboard(u.email, "البريد الإلكتروني")}
                              title="نسخ البريد"
                            >
                              {copiedText === u.email ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                            </Button>
                          </div>
                        </TableCell>

                        <TableCell className="text-start">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground">
                            <span className="rounded-md bg-muted px-2 py-0.5">{password}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6 text-muted-foreground hover:text-foreground"
                              onClick={() => copyToClipboard(password, "كلمة المرور")}
                              title="نسخ كلمة المرور"
                            >
                              {copiedText === password ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                            </Button>
                          </div>
                        </TableCell>

                        <TableCell className="text-start">
                          <Badge
                            variant={u.role === "admin" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {u.role === "admin" ? "مدير نظام" : "مسؤول مبيعات"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center font-bold text-xs">
                          {total}
                        </TableCell>

                        <TableCell className="text-center font-semibold text-xs text-blue-600">
                          {contacted}
                        </TableCell>

                        <TableCell className="text-center font-bold text-xs text-emerald-600">
                          {subscribed}
                        </TableCell>

                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate({ to: "/clients", search: { owner: u.id } })}
                              className="h-7 gap-1 rounded-lg text-xs"
                            >
                              <span>صالوناته ({total})</span>
                              <ExternalLink className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUserForEdit(u);
                                setUserModalOpen(true);
                              }}
                              className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                              title="تعديل بيانات الموظف أو كلمة المرور أو حذفه"
                            >
                              <Edit3 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* AGENT ONLY: Personal Profile & Password Change */
        <Card className="rounded-3xl border-border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="size-4 text-primary" />
              الملف الشخصي والحساب
            </CardTitle>
            <CardDescription className="text-xs">
              معلومات حسابك المستخدمة في تسجيل الدخول ومتابعة صالوناتك
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-base font-bold text-primary">
                  {currentUser?.name?.slice(0, 1) || "م"}
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">{currentUser?.name}</h3>
                  <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {currentUser?.email}
                  </p>
                  <div className="mt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      مسؤول مبيعات
                    </Badge>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => {
                  setSelectedUserForEdit(currentUser);
                  setUserModalOpen(true);
                }}
                variant="outline"
                className="gap-2 rounded-xl text-xs font-semibold"
              >
                <Edit3 className="size-3.5" />
                تعديل بياناتي / تغيير كلمة المرور
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ADMIN ONLY: Data Export */}
      {isAdmin && (
        <Card className="rounded-3xl border-border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Download className="size-4 text-primary" />
              تصدير البيانات والنسخ الاحتياطي
            </CardTitle>
            <CardDescription className="text-xs">
              تحميل نسخ CSV مشفرة بـ UTF-8 BOM متوافقة تمامًا مع Microsoft Excel واللغة العربية
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border p-4 bg-muted/20">
              <div>
                <p className="font-bold text-sm text-foreground">قاعدة بيانات الصالونات والعملاء</p>
                <p className="text-xs text-muted-foreground">
                  تتضمن الأكواد، أرقام الهواتف، العناوين، وحالات التواصل والمتابعة
                </p>
              </div>
              <Button
                variant="outline"
                disabled={exportingClients}
                onClick={handleExportClients}
                className="h-10 gap-2 rounded-xl text-xs"
              >
                <FileSpreadsheet className="size-4 text-emerald-600" />
                {exportingClients ? "جارٍ التصدير..." : "تصدير العملاء (CSV)"}
              </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border p-4 bg-muted/20">
              <div>
                <p className="font-bold text-sm text-foreground">سجل التواصل والمحادثات الكامل</p>
                <p className="text-xs text-muted-foreground">
                  يتضمن جميع محاولات التواصل، نتائجها، ملخصات الردود، والتواريخ
                </p>
              </div>
              <Button
                variant="outline"
                disabled={exportingLogs}
                onClick={handleExportLogs}
                className="h-10 gap-2 rounded-xl text-xs"
              >
                <FileSpreadsheet className="size-4 text-emerald-600" />
                {exportingLogs ? "جارٍ التصدير..." : "تصدير سجل التواصل (CSV)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Information */}
      <Card className="rounded-3xl border-border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Server className="size-4 text-muted-foreground" />
            معلومات الخادم والبيئة
          </CardTitle>
          <CardDescription className="text-xs">
            تفاصيل الربط التقني لقاعدة البيانات والخادم
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-border bg-card p-3">
              <span className="text-muted-foreground">محرك قاعدة البيانات</span>
              <p className="mt-1 font-bold text-foreground">PocketBase (SQLite Embedded)</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <span className="text-muted-foreground">المنطقة الزمنية المعتمدة</span>
              <p className="mt-1 font-bold text-foreground">توقيت الرياض (Asia/Riyadh - UTC+3)</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <span className="text-muted-foreground">بيئة التشغيل</span>
              <p className="mt-1 font-bold text-foreground">Linux VPS (systemd + HTTPS)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Form Dialog (Add / Edit / Delete) */}
      <UserFormDialog
        open={userModalOpen}
        onOpenChange={setUserModalOpen}
        user={selectedUserForEdit}
        currentUser={currentUser}
      />
    </div>
  );
}
