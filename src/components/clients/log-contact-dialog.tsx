import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, Calendar, CheckCircle2, Clock, MessageSquare, Phone, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useClients, useSaveContactLog } from "@/hooks/use-crm";
import {
  ATTEMPT_TYPES,
  CHANNELS,
  CONTACT_RESULTS,
  NEXT_ACTIONS,
  REPLIED_OPTIONS,
} from "@/lib/constants";
import { getRiyadhDateKey } from "@/lib/utils";
import type {
  AttemptType,
  Client,
  ContactChannel,
  ContactLog,
  ContactResult,
  NextAction,
  RepliedOption,
} from "@/lib/types";

interface LogContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSuccess?: (log: ContactLog) => void;
}

function computeQuickDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = ("0" + (d.getMonth() + 1)).slice(-2);
  const day = ("0" + d.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

export function LogContactDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: LogContactDialogProps) {
  const saveLog = useSaveContactLog();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [channel, setChannel] = useState<ContactChannel>("واتساب");
  const [attemptType, setAttemptType] = useState<AttemptType>("رسالة أولى");
  const [replied, setReplied] = useState<RepliedOption>("نعم");
  const [result, setResult] = useState<ContactResult>("مهتم");
  const [contactedAt, setContactedAt] = useState<string>("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string>("");
  const [replySummary, setReplySummary] = useState<string>("");
  const [nextAction, setNextAction] = useState<NextAction>("متابعة لاحقًا");
  const [updateClient, setUpdateClient] = useState<boolean>(true);

  // If client prop changes or dialog opens
  useEffect(() => {
    if (open) {
      setSelectedClientId(client?.id ?? "");
      const now = new Date();
      // Format as local datetime for input: YYYY-MM-DDTHH:mm
      const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setContactedAt(localDatetime);
      setChannel("واتساب");
      setAttemptType("رسالة أولى");
      setReplied("نعم");
      setResult("مهتم");
      setNextFollowUpDate(computeQuickDate(3));
      setReplySummary("");
      setNextAction("متابعة لاحقًا");
      setUpdateClient(true);
    }
  }, [open, client]);

  // Clients list for client picker when client is not preselected
  const { data: clientsData } = useClients({ perPage: 100 });
  const clientsList = clientsData?.items ?? [];

  const effectiveClient = client ?? clientsList.find((c) => c.id === selectedClientId);

  const isDnc = result === "طلب عدم التواصل";

  const handleResultChange = (val: ContactResult) => {
    setResult(val);
    if (val === "طلب عدم التواصل") {
      setNextFollowUpDate("");
      setUpdateClient(true);
      setNextAction("إيقاف التواصل");
    } else if (val === "مهتم") {
      setReplied("نعم");
      setNextFollowUpDate(computeQuickDate(2));
      setNextAction("إرسال تفاصيل");
    } else if (val === "لم يرد") {
      setReplied("لا");
      setNextFollowUpDate(computeQuickDate(3));
      setNextAction("انتظار الرد");
    } else if (val === "طلب عرض" || val === "طلب تفاصيل") {
      setReplied("نعم");
      setNextFollowUpDate(computeQuickDate(1));
      setNextAction("إرسال تفاصيل");
    } else if (val === "إعادة التواصل لاحقًا") {
      setReplied("نعم");
      setNextFollowUpDate(computeQuickDate(7));
      setNextAction("متابعة لاحقًا");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const targetClientId = effectiveClient?.id || selectedClientId;

    if (!targetClientId) {
      toast.error("يرجى اختيار الصالون أولًا");
      return;
    }

    try {
      const log = await saveLog.mutateAsync({
        client_id: targetClientId,
        contacted_at: contactedAt ? new Date(contactedAt).toISOString() : new Date().toISOString(),
        channel,
        attempt_type: attemptType,
        replied,
        result,
        next_follow_up_date: isDnc ? null : nextFollowUpDate || null,
        reply_summary: replySummary,
        next_action: nextAction,
        chat_url: effectiveClient?.chat_url || "",
        update_client: isDnc ? true : updateClient,
      });

      toast.success("تم تسجيل التواصل وتحديث العميل بنجاح");
      onOpenChange(false);
      onSuccess?.(log);
    } catch (err: any) {
      toast.error(err?.message || "تعذّر تسجيل التواصل");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto sm:rounded-2xl" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <MessageSquare className="size-5 text-primary" />
            تسجيل تواصل جديد
          </DialogTitle>
          <DialogDescription>
            سجّلي نتيجة التواصل وحدّثي حالة الصالون وتاريخ المتابعة القادمة.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* Client Selection (shown if not preselected) */}
          {!client && (
            <div className="space-y-1.5">
              <Label htmlFor="client-select" className="text-sm font-semibold">
                الصالون <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client-select" className="h-10 rounded-xl text-start">
                  <SelectValue placeholder="اختر الصالون..." />
                </SelectTrigger>
                <SelectContent className="max-h-60" dir="rtl">
                  {clientsList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.code}) - {c.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Client info banner if preselected */}
          {effectiveClient && (
            <div className="flex items-center justify-between rounded-xl bg-muted/60 p-3 text-sm">
              <div>
                <p className="font-bold text-foreground">{effectiveClient.name}</p>
                <p className="text-xs text-muted-foreground">
                  {effectiveClient.code} · {effectiveClient.city} · {effectiveClient.phone}
                </p>
              </div>
              <span className="rounded-md bg-background px-2 py-1 text-xs font-medium text-foreground shadow-xs">
                {effectiveClient.contact_status}
              </span>
            </div>
          )}

          {/* DNC Warning Banner */}
          {isDnc && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold">تحذير: سيتم إيقاف التواصل فورًا</p>
                <p className="mt-0.5">
                  سيتم تغيير حالة العميل إلى "تم إيقاف التواصل" وتصنيفه كـ "لا يرغب بالتواصل" وحذف أي متابعات مجدولة.
                </p>
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contacted_at" className="text-xs font-semibold">
                تاريخ ووقت التواصل <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contacted_at"
                type="datetime-local"
                value={contactedAt}
                onChange={(e) => setContactedAt(e.target.value)}
                required
                className="h-10 rounded-xl"
              />
            </div>

            {/* Attempt Type */}
            <div className="space-y-1.5">
              <Label htmlFor="attempt_type" className="text-xs font-semibold">
                نوع المحاولة
              </Label>
              <Select value={attemptType} onValueChange={(v) => setAttemptType(v as AttemptType)}>
                <SelectTrigger id="attempt_type" className="h-10 rounded-xl text-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {ATTEMPT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Channel Chips */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">قناة التواصل</Label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => {
                const active = channel === ch;
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Replied 3-Way Toggle & Result */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">هل ردّ الصالون؟</Label>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1">
                {REPLIED_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setReplied(opt)}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
                      replied === opt
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-result" className="text-xs font-semibold">
                نتيجة التواصل <span className="text-destructive">*</span>
              </Label>
              <Select value={result} onValueChange={(v) => handleResultChange(v as ContactResult)}>
                <SelectTrigger id="contact-result" className="h-10 rounded-xl text-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {CONTACT_RESULTS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Next Follow-up Date & Quick Chips (hidden if DNC) */}
          {!isDnc && (
            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="next_follow_up" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Calendar className="size-3.5 text-primary" />
                  تاريخ المتابعة القادمة
                </Label>
                {nextFollowUpDate && (
                  <span className="text-[11px] text-muted-foreground">
                    الموعد المحدد: {nextFollowUpDate}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "غدًا (+1)", days: 1 },
                  { label: "+2 يوم", days: 2 },
                  { label: "+3 أيام", days: 3 },
                  { label: "+أسبوع", days: 7 },
                  { label: "+أسبوعين", days: 14 },
                ].map((chip) => {
                  const targetDate = computeQuickDate(chip.days);
                  const isSelected = nextFollowUpDate === targetDate;
                  return (
                    <button
                      key={chip.days}
                      type="button"
                      onClick={() => setNextFollowUpDate(targetDate)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? "bg-accent text-accent-foreground font-bold"
                          : "bg-background text-muted-foreground hover:text-foreground border border-border"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setNextFollowUpDate("")}
                  className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  بدون موعد
                </button>
              </div>

              <Input
                id="next_follow_up"
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="h-9 rounded-lg bg-background text-xs"
              />
            </div>
          )}

          {/* Next Action */}
          <div className="space-y-1.5">
            <Label htmlFor="next_action" className="text-xs font-semibold">
              الإجراء القادم
            </Label>
            <Select value={nextAction} onValueChange={(v) => setNextAction(v as NextAction)}>
              <SelectTrigger id="next_action" className="h-10 rounded-xl text-start">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {NEXT_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reply Summary */}
          <div className="space-y-1.5">
            <Label htmlFor="reply_summary" className="text-xs font-semibold">
              ملخص الرد أو الملاحظات
            </Label>
            <Textarea
              id="reply_summary"
              value={replySummary}
              onChange={(e) => setReplySummary(e.target.value)}
              placeholder="اكتب ملاحظات التواصل، متطلبات الصالون، أو سبب الرفض/الاهتمام..."
              rows={2}
              className="resize-none rounded-xl text-sm"
            />
          </div>

          {/* Automatic Client Update Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="auto-update-client"
              checked={isDnc ? true : updateClient}
              disabled={isDnc}
              onCheckedChange={(c) => setUpdateClient(Boolean(c))}
            />
            <Label
              htmlFor="auto-update-client"
              className="cursor-pointer text-xs text-muted-foreground"
            >
              تحديث حالة الصالون وتصنيفه تلقائيًا بناءً على نتيجة التواصل
            </Label>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:justify-start">
            <Button
              type="submit"
              disabled={saveLog.isPending}
              className="h-10 flex-1 rounded-xl sm:flex-initial"
            >
              {saveLog.isPending ? "جارٍ الحفظ..." : "حفظ سجل التواصل"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-xl"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
