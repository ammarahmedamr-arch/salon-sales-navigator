import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Database,
  Download,
  FileSpreadsheet,
  Lock,
  Mail,
  Plus,
  Server,
  Shield,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTeamUsers } from "@/hooks/use-crm";
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
  const authContext = Route.useRouteContext() as any;
  const currentUser: AppUser = authContext?.user;
  const isAdmin = currentUser?.role === "admin";

  const { data: users, isLoading: usersLoading } = useTeamUsers();

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [pending, setPending] = useState(false);
  const [exportingClients, setExportingClients] = useState(false);
  const [exportingLogs, setExportingLogs] = useState(false);

  const handleCreateMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }

    setPending(true);
    try {
      await api.users.create({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });

      toast.success("تمت إضافة عضو الفريق بنجاح");
      setAddMemberOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("agent");
      void queryClient.invalidateQueries({ queryKey: ["team-users"] });
    } catch (err: any) {
      toast.error(err?.message || "تعذّر إنشاء العضو");
    } finally {
      setPending(false);
    }
  };

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
        <h1 className="text-2xl font-bold tracking-tight">الإعدادات وإدارة النظام</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          إدارة أعضاء فريق المبيعات، صلاحيات الوصول، وتصدير البيانات
        </p>
      </div>

      {/* Section 1: Team Members */}
      <Card className="rounded-2xl border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="size-4 text-primary" />
              أعضاء فريق المبيعات ({users?.length ?? 0})
            </CardTitle>
            <CardDescription className="text-xs">
              المستخدمون المصرح لهم بتسجيل الدخول والوصول للنظام
            </CardDescription>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => setAddMemberOpen(true)}
              className="h-9 gap-1.5 rounded-xl text-xs"
            >
              <Plus className="size-3.5" />
              إضافة عضو فريق
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-1">
          <div className="overflow-hidden rounded-xl border border-border">
            <Table dir="rtl">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-start">الاسم</TableHead>
                  <TableHead className="text-start">البريد الإلكتروني</TableHead>
                  <TableHead className="text-start">الدور والصلاحية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">
                      جارٍ تحميل قائمة الأعضاء...
                    </TableCell>
                  </TableRow>
                ) : !users || users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">
                      لا يوجد أعضاء في الفريق حاليًا.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-xs text-foreground">
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
                      <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === "admin" ? "default" : "secondary"}
                          className="text-[11px]"
                        >
                          {u.role === "admin" ? "مدير نظام" : "وكيل مبيعات"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Data Export */}
      <Card className="rounded-2xl border-border">
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

      {/* Section 3: System Information */}
      <Card className="rounded-2xl border-border">
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
              <p className="mt-1 font-bold text-foreground">Linux VPS (systemd + Caddy HTTPS)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="max-w-md sm:rounded-2xl" dir="rtl">
          <DialogHeader className="text-start">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <User className="size-5 text-primary" />
              إضافة عضو فريق جديد
            </DialogTitle>
            <DialogDescription>
              أنشئ حسابًا جديدًا لأحد موظفي المبيعات للوصول للنظام.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMember} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="member-name" className="text-xs font-semibold">
                الاسم الثلاثي <span className="text-destructive">*</span>
              </Label>
              <Input
                id="member-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: عبد الله السبيعي"
                required
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="member-email" className="text-xs font-semibold">
                البريد الإلكتروني <span className="text-destructive">*</span>
              </Label>
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@ojlinker.sa"
                dir="ltr"
                required
                className="h-10 rounded-xl text-start"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="member-password" className="text-xs font-semibold">
                كلمة المرور (8 خانات على الأقل) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="member-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                required
                minLength={8}
                className="h-10 rounded-xl text-start"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="member-role" className="text-xs font-semibold">
                الدور والصلاحية
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "agent")}>
                <SelectTrigger id="member-role" className="h-10 rounded-xl text-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="agent">وكيل مبيعات (إضافة وتعديل صالونات وتسجيل تواصل)</SelectItem>
                  <SelectItem value="admin">مدير نظام (صلاحيات كاملة تشمل الحذف وإدارة الفريق)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="mt-4 gap-2 sm:justify-start">
              <Button type="submit" disabled={pending} className="h-10 rounded-xl">
                {pending ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddMemberOpen(false)}
                className="h-10 rounded-xl"
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
