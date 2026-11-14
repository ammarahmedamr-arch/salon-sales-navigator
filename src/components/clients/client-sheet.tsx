import { useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  Clock,
  Edit2,
  ExternalLink,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  User,
  UserCheck,
  UserPlus,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientLogs, useDeleteClient, useSaveClient, useTeamUsers } from "@/hooks/use-crm";
import { buildWhatsAppUrl, formatArabicDate } from "@/lib/utils";
import type { Client } from "@/lib/types";

interface ClientSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onEdit: (client: Client) => void;
  onLogContact: (client: Client) => void;
  isAdmin?: boolean;
}

export function ClientSheet({
  open,
  onOpenChange,
  client,
  onEdit,
  onLogContact,
  isAdmin = false,
}: ClientSheetProps) {
  const deleteClient = useDeleteClient();
  const saveClient = useSaveClient();
  const { data: teamUsers = [] } = useTeamUsers();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: logs, isLoading: logsLoading } = useClientLogs(client?.id ?? "");

  if (!client) return null;

  const handleReassign = async (newOwnerId: string) => {
    try {
      await saveClient.mutateAsync({
        id: client.id,
        input: {
          ...client,
          owner: newOwnerId === "none" ? "" : newOwnerId,
        },
      });
      const targetUser = teamUsers.find((u) => u.id === newOwnerId);
      toast.success(
        newOwnerId === "none"
          ? "تم إلغاء التعيين وأصبح الصالون متاحاً"
          : `تم إسناد الصالون إلى ${targetUser?.name || "الموظف"} بنجاح`
      );
    } catch (err: any) {
      toast.error(err?.message || "تعذر تحديث المسؤول");
    }
  };

  const waUrl = buildWhatsAppUrl(
    client.phone,
    `مرحبًا ${client.name}، نتواصل معكم من OJLinker بخصوص خدمات الصالونات.`
  );

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    try {
      await deleteClient.mutateAsync(client.id);
      toast.success("تم حذف الصالون بنجاح");
      onOpenChange(false);
      setConfirmDelete(false);
    } catch (err: any) {
      toast.error(err?.message || "تعذّر حذف الصالون (صلاحية المدير مطلوبة)");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
        dir="rtl"
      >
        <SheetHeader className="border-b border-border bg-card/60 p-6 text-start">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              {client.code}
            </span>
            <Badge
              variant={client.priority === "عالية" ? "destructive" : "secondary"}
              className="text-xs"
            >
              الأولوية {client.priority}
            </Badge>
          </div>
          <SheetTitle className="text-xl font-bold text-foreground">{client.name}</SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-xs">
            <MapPin className="size-3.5" />
            {client.city} · {client.business_type}
          </SheetDescription>
        </SheetHeader>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 p-4">
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-medium text-white shadow-xs transition-colors hover:bg-emerald-700"
          >
            <MessageSquare className="size-4" />
            واتساب
          </a>

          <a
            href={`tel:${client.phone}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
          >
            <Phone className="size-4" />
            اتصال
          </a>

          <Button
            size="sm"
            onClick={() => onLogContact(client)}
            className="h-9 gap-1.5 rounded-xl"
          >
            <Plus className="size-4" />
            تسجيل تواصل
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(client)}
            className="h-9 gap-1.5 rounded-xl"
          >
            <Edit2 className="size-3.5" />
            تعديل
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              variant={confirmDelete ? "destructive" : "ghost"}
              onClick={handleDelete}
              className="h-9 gap-1.5 rounded-xl text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
              {confirmDelete ? "تأكيد الحذف؟" : "حذف"}
            </Button>
          )}
        </div>

        {/* Body content */}
        <div className="flex-1 space-y-6 p-6">
          {/* Status & Outcome */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/80 bg-card p-3">
              <span className="text-[11px] text-muted-foreground">حالة التواصل</span>
              <p className="mt-1 font-bold text-foreground text-sm">{client.contact_status}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-3">
              <span className="text-[11px] text-muted-foreground">النتيجة الحالية</span>
              <p className="mt-1 font-bold text-foreground text-sm">{client.outcome}</p>
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 text-xs">
            {/* Responsible sales agent */}
            <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
              <span className="font-semibold text-foreground">المسؤول عن المتابعة:</span>
              <Select
                value={client.owner || "none"}
                onValueChange={(val) => handleReassign(val)}
              >
                <SelectTrigger className="h-8 w-44 rounded-xl text-xs font-bold">
                  <SelectValue>
                    {client.owner_name ||
                      teamUsers.find((u) => u.id === client.owner)?.name ||
                      "غير مخصص (متاح)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">غير مخصص (متاح للاستلام)</SelectItem>
                  {teamUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role === "admin" ? "مدير" : "مندوب"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">رقم الجوال:</span>
              <span className="font-mono font-medium text-foreground" dir="ltr">
                {client.phone}
              </span>
            </div>

            {client.contact_person && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">المسؤول:</span>
                <span className="font-medium text-foreground">{client.contact_person}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">المصدر:</span>
              <span className="font-medium text-foreground">{client.source}</span>
            </div>

            {client.next_follow_up_date && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">المتابعة القادمة:</span>
                <span className="font-semibold text-primary">{client.next_follow_up_date}</span>
              </div>
            )}

            {client.last_contact_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">آخر تواصل:</span>
                <span className="text-muted-foreground">
                  {formatArabicDate(client.last_contact_at)}
                </span>
              </div>
            )}

            {client.notes && (
              <div className="border-t border-border/70 pt-2 text-start">
                <span className="text-muted-foreground">ملاحظات:</span>
                <p className="mt-1 text-foreground leading-relaxed">{client.notes}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Contact Logs Timeline */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                سجل المتابعات السابقة ({logs?.length ?? 0})
              </h4>
            </div>

            {logsLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">جارٍ تحميل السجل...</p>
            ) : !logs || logs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                لم يتم تسجيل أي تواصل مع هذا الصالون بعد.
              </div>
            ) : (
              <div className="relative space-y-4 ps-4 before:absolute before:bottom-2 before:start-1.5 before:top-2 before:w-0.5 before:bg-border">
                {logs.map((log) => (
                  <div key={log.id} className="relative text-xs">
                    <span className="absolute -start-[19px] top-1.5 size-2 rounded-full bg-primary" />
                    <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{log.channel}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatArabicDate(log.contacted_at)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {log.result}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          رد الصالون: {log.replied}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {log.attempt_type}
                        </span>
                      </div>
                      {log.reply_summary && (
                        <p className="mt-2 text-foreground/90 leading-relaxed">
                          {log.reply_summary}
                        </p>
                      )}
                      {log.next_action && log.next_action !== "لا إجراء" && (
                        <p className="mt-1 text-[11px] text-primary/90 font-medium">
                          الإجراء القادم: {log.next_action}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
