import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Building2, Save } from "lucide-react";
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
import { useSaveClient, useTeamUsers } from "@/hooks/use-crm";
import {
  BUSINESS_TYPES,
  CITIES,
  CONTACT_STATUSES,
  OUTCOMES,
  PRIORITIES,
  SOURCES,
} from "@/lib/constants";
import { normalizePhone } from "@/lib/utils";
import type {
  BusinessType,
  City,
  Client,
  ClientInput,
  ClientOutcome,
  ClientSource,
  ContactStatus,
  Priority,
} from "@/lib/types";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSuccess?: (saved: Client) => void;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: ClientFormDialogProps) {
  const saveClient = useSaveClient();
  const { data: teamUsers } = useTeamUsers();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState<City>("الرياض");
  const [businessType, setBusinessType] = useState<BusinessType>("صالون نسائي");
  const [contactPerson, setContactPerson] = useState("");
  const [source, setSource] = useState<ClientSource>("خرائط Google");
  const [priority, setPriority] = useState<Priority>("متوسطة");
  const [contactStatus, setContactStatus] = useState<ContactStatus>("لم يتم التواصل");
  const [outcome, setOutcome] = useState<ClientOutcome>("غير محدد");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [chatUrl, setChatUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState("");

  const isEditing = Boolean(client);

  useEffect(() => {
    if (open) {
      if (client) {
        setName(client.name || "");
        setPhone(client.phone || "");
        setCity(client.city || "الرياض");
        setBusinessType(client.business_type || "صالون نسائي");
        setContactPerson(client.contact_person || "");
        setSource(client.source || "خرائط Google");
        setPriority(client.priority || "متوسطة");
        setContactStatus(client.contact_status || "لم يتم التواصل");
        setOutcome(client.outcome || "غير محدد");
        setNextFollowUpDate(client.next_follow_up_date || "");
        setWebsiteUrl(client.website_url || "");
        setChatUrl(client.chat_url || "");
        setNotes(client.notes || "");
        setOwner(client.owner || "");
      } else {
        setName("");
        setPhone("");
        setCity("الرياض");
        setBusinessType("صالون نسائي");
        setContactPerson("");
        setSource("خرائط Google");
        setPriority("متوسطة");
        setContactStatus("لم يتم التواصل");
        setOutcome("غير محدد");
        setNextFollowUpDate("");
        setWebsiteUrl("");
        setChatUrl("");
        setNotes("");
        setOwner("");
      }
    }
  }, [open, client]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("يرجى كتابة اسم الصالون");
      return;
    }

    let normalizedPhone = "";
    try {
      normalizedPhone = normalizePhone(phone);
    } catch (err: any) {
      toast.error(err?.message || "رقم الهاتف غير صحيح، يجب أن يكون رقم جوال سعودي يبدأ بـ 05");
      return;
    }

    const payload: ClientInput = {
      name: name.trim(),
      phone: normalizedPhone,
      city,
      business_type: businessType,
      contact_person: contactPerson.trim(),
      source,
      priority,
      contact_status: contactStatus,
      outcome,
      last_contact_at: client?.last_contact_at ?? null,
      next_follow_up_date: nextFollowUpDate || null,
      website_url: websiteUrl.trim(),
      chat_url: chatUrl.trim(),
      notes: notes.trim(),
      owner,
    };

    try {
      const saved = await saveClient.mutateAsync(
        client
          ? { id: client.id, input: payload }
          : { input: payload }
      );

      toast.success(isEditing ? "تم تحديث بيانات الصالون بنجاح" : "تمت إضافة الصالون بنجاح");
      onOpenChange(false);
      onSuccess?.(saved);
    } catch (err: any) {
      toast.error(err?.message || "تعذّر حفظ بيانات الصالون");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto sm:rounded-2xl" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Building2 className="size-5 text-primary" />
            {isEditing ? `تعديل صالون: ${client?.name}` : "إضافة صالون جديد"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "حدّث بيانات الصالون ومعلومات التواصل والتصنيف الحالي."
              : "أدخل بيانات الصالون الجديد ليتم إدراجه في مسار المبيعات."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* Row 1: Name & Phone */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-name" className="text-xs font-semibold">
                اسم الصالون <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: صالون لمسة حرير"
                required
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-phone" className="text-xs font-semibold">
                رقم الجوال <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                dir="ltr"
                required
                className="h-10 rounded-xl text-start"
              />
            </div>
          </div>

          {/* Row 2: City & Business Type */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-city" className="text-xs font-semibold">
                المدينة <span className="text-destructive">*</span>
              </Label>
              <Select value={city} onValueChange={(v) => setCity(v as City)}>
                <SelectTrigger id="client-city" className="h-10 rounded-xl text-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {CITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-business-type" className="text-xs font-semibold">
                نوع النشاط
              </Label>
              <Select
                value={businessType}
                onValueChange={(v) => setBusinessType(v as BusinessType)}
              >
                <SelectTrigger id="client-business-type" className="h-10 rounded-xl text-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {BUSINESS_TYPES.map((bt) => (
                    <SelectItem key={bt} value={bt}>
                      {bt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Contact Person & Source */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-contact-person" className="text-xs font-semibold">
                اسم المسؤول / المديرة
              </Label>
              <Input
                id="client-contact-person"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="مثال: أم عبد الله"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-source" className="text-xs font-semibold">
                المصدر
              </Label>
              <Select value={source} onValueChange={(v) => setSource(v as ClientSource)}>
                <SelectTrigger id="client-source" className="h-10 rounded-xl text-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: Priority & Owner */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-priority" className="text-xs font-semibold">
                الأولوية
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="client-priority" className="h-10 rounded-xl text-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-owner" className="text-xs font-semibold">
                المسؤول عن الصالون
              </Label>
              <Select value={owner || "none"} onValueChange={(v) => setOwner(v === "none" ? "" : v)}>
                <SelectTrigger id="client-owner" className="h-10 rounded-xl text-start">
                  <SelectValue placeholder="غير مخصص" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">غير مخصص</SelectItem>
                  {(teamUsers || []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 5: Contact Status & Outcome */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-status" className="text-xs font-semibold">
                حالة التواصل
              </Label>
              <Select
                value={contactStatus}
                onValueChange={(v) => setContactStatus(v as ContactStatus)}
              >
                <SelectTrigger id="client-status" className="h-10 rounded-xl text-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {CONTACT_STATUSES.map((cs) => (
                    <SelectItem key={cs} value={cs}>
                      {cs}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-outcome" className="text-xs font-semibold">
                النتيجة
              </Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as ClientOutcome)}>
                <SelectTrigger id="client-outcome" className="h-10 rounded-xl text-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 6: Next Follow-up Date */}
          <div className="space-y-1.5">
            <Label htmlFor="client-next-date" className="text-xs font-semibold">
              تاريخ المتابعة القادمة
            </Label>
            <Input
              id="client-next-date"
              type="date"
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>

          {/* Row 7: Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="client-notes" className="text-xs font-semibold">
              ملاحظات عامة
            </Label>
            <Textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب أي معلومات هامة حول الصالون، عدد الموظفات، الموقع، إلخ..."
              rows={2}
              className="resize-none rounded-xl text-sm"
            />
          </div>

          <DialogFooter className="mt-4 gap-2 sm:justify-start">
            <Button
              type="submit"
              disabled={saveClient.isPending}
              className="h-10 flex-1 rounded-xl sm:flex-initial"
            >
              <Save className="size-4" />
              {saveClient.isPending ? "جارٍ الحفظ..." : isEditing ? "تحديث الصالون" : "إضافة الصالون"}
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
