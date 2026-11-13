import React, { useState } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { crmKeys, useUsers } from "@/hooks/use-crm";
import { normalizePhone } from "@/lib/utils";
import type { ClientInput } from "@/lib/types";

interface ParsedSalonRow {
  name: string;
  phone: string;
  city: string;
  business_type: string;
  contact_person: string;
  website_url: string;
  source: string;
  priority: string;
  notes: string;
  excelOwnerName?: string;
}

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportExcelDialog({ open, onOpenChange }: ImportExcelDialogProps) {
  const queryClient = useQueryClient();
  const { data: teamUsers = [] } = useUsers();

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedSalonRow[]>([]);
  const [distributionMode, setDistributionMode] = useState<
    "unassigned" | "round-robin" | "single" | "excel"
  >("unassigned");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number } | null>(
    null
  );

  // Set default agent when users load
  React.useEffect(() => {
    if (teamUsers.length > 0 && !selectedAgentId) {
      const defaultUser = teamUsers.find((u) => u.name === "محمد سيد") || teamUsers[0];
      if (defaultUser) setSelectedAgentId(defaultUser.id);
    }
  }, [teamUsers, selectedAgentId]);

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setProgress(0);
    setImportSummary(null);
    setIsImporting(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportSummary(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      // Look for sheet named "العملاء" or fallback to first sheet
      const sheetName =
        workbook.SheetNames.find((name) => name.includes("العملاء") || name.includes("صالون")) ||
        workbook.SheetNames[0];

      if (!sheetName) {
        toast.error("الملف لا يحتوي على أوراق عمل صالحة.");
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        toast.error("تعذر قراءة الورقة المطلوبة.");
        return;
      }

      // Convert to JSON with headers
      const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

      if (rawData.length === 0) {
        toast.error("لم يتم العثور على أي بيانات داخل ورقة العمل.");
        return;
      }

      const rows: ParsedSalonRow[] = [];

      for (const row of rawData) {
        // Find column by common aliases
        const findVal = (keys: string[]): string => {
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              if (rowKey.trim().toLowerCase() === k.trim().toLowerCase()) {
                return String(row[rowKey] ?? "").trim();
              }
            }
          }
          return "";
        };

        const name = findVal(["اسم الصالون", "الصالون", "اسم العميل", "الاسم", "name", "salon"]);
        if (!name || name === "اسم الصالون" || name.includes("صف تجريبي")) {
          // Skip header repeats or demo instruction rows
          continue;
        }

        const rawPhone = findVal([
          "رقم واتساب/هاتف",
          "رقم الهاتف",
          "رقم الجوال",
          "الهاتف",
          "الجوال",
          "واتساب",
          "phone",
          "mobile",
        ]);

        const city = findVal(["المدينة", "city"]) || "الرياض";
        const business_type = findVal(["نوع النشاط", "النشاط", "نوع الصالون", "business_type"]) || "صالون نسائي";
        const contact_person = findVal(["اسم المسؤول", "المسؤول", "جهة الاتصال", "contact_person"]);
        const website_url = findVal(["رابط الموقع/إنستجرام", "الموقع", "إنستجرام", "website_url"]);
        const source = findVal(["مصدر البيانات", "المصدر", "source"]) || "بحث يدوي";
        const priority = findVal(["الأولوية", "priority"]) || "متوسطة";
        const notes = findVal(["ملاحظات / احتياج العميل", "ملاحظات", "notes"]);
        const excelOwnerName = findVal(["المسؤول عن المتابعة", "المسؤول", "الموظف", "owner"]);

        rows.push({
          name,
          phone: rawPhone,
          city,
          business_type,
          contact_person,
          website_url,
          source,
          priority,
          notes,
          excelOwnerName,
        });
      }

      if (rows.length === 0) {
        toast.error("لم نتمكن من استخراج صالونات صالحة. تأكد من وجود عمود 'اسم الصالون'.");
        return;
      }

      setParsedRows(rows);
      toast.success(`تم العثور على ${rows.length} صالون جاهز للاستيراد.`);
    } catch (err: any) {
      console.error("Excel parse error:", err);
      toast.error("فشل قراءة ملف Excel: " + (err?.message || "تأكد من صيغة الملف"));
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "رقم العميل": "SAL-0001",
        "اسم الصالون": "صالون لمسات الجمال",
        "المدينة": "الرياض",
        "نوع النشاط": "صالون نسائي",
        "اسم المسؤول": "أم سارة",
        "رقم واتساب/هاتف": "0551234567",
        "رابط الموقع/إنستجرام": "https://instagram.com/beauty_salon",
        "مصدر البيانات": "خرائط Google",
        "الأولوية": "عالية",
        "ملاحظات / احتياج العميل": "مهتمون بنظام إدارة المواعيد",
        "المسؤول عن المتابعة": "محمد سيد",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");
    XLSX.writeFile(workbook, "OJLinker_Salons_Template.xlsx");
    toast.success("تم تنزيل النموذج المعتمد.");
  };

  const handleStartImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    setProgress(0);

    const activeAgents = teamUsers.filter((u) => u.role === "agent");
    const eligibleTeam = activeAgents.length > 0 ? activeAgents : teamUsers;

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      if (!row) continue;

      // Determine owner
      let ownerId = "";
      if (distributionMode === "unassigned") {
        ownerId = "";
      } else if (distributionMode === "round-robin" && eligibleTeam.length > 0) {
        const assignedUser = eligibleTeam[i % eligibleTeam.length];
        ownerId = assignedUser?.id ?? "";
      } else if (distributionMode === "single" && selectedAgentId) {
        ownerId = selectedAgentId;
      } else if (distributionMode === "excel" && row.excelOwnerName) {
        const matched = teamUsers.find(
          (u) =>
            u.name.trim().toLowerCase() === row.excelOwnerName?.trim().toLowerCase() ||
            u.email.toLowerCase().includes(row.excelOwnerName?.trim().toLowerCase() || "")
        );
        ownerId = matched ? matched.id : "";
      }

      // Format mobile
      const cleanPhone = normalizePhone(row.phone || "0500000000");

      const input: ClientInput = {
        name: row.name,
        phone: cleanPhone,
        city: row.city as any,
        business_type: row.business_type as any,
        contact_person: row.contact_person,
        website_url: row.website_url,
        source: (row.source || "بحث يدوي") as any,
        priority: (row.priority || "متوسطة") as any,
        contact_status: "لم يتم التواصل",
        outcome: "غير محدد",
        last_contact_at: null,
        next_follow_up_date: null,
        chat_url: "",
        notes: row.notes,
        owner: ownerId,
      };

      try {
        await api.clients.create(input);
        successCount++;
      } catch (err) {
        console.warn(`Failed to import row ${row.name}:`, err);
        failCount++;
      }

      setProgress(Math.round(((i + 1) / parsedRows.length) * 100));
    }

    setIsImporting(false);
    setImportSummary({ success: successCount, failed: failCount });

    // Invalidate CRM queries to refresh Dashboard and Clients list
    queryClient.invalidateQueries({ queryKey: crmKeys.clients });
    queryClient.invalidateQueries({ queryKey: crmKeys.stats });
    queryClient.invalidateQueries({ queryKey: crmKeys.recentLogs });

    toast.success(`تم استيراد ${successCount} صالون بنجاح وتوزيعهم على الفريق!`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isImporting) {
          onOpenChange(v);
          if (!v) handleReset();
        }
      }}
    >
      <DialogContent className="max-w-2xl rounded-3xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  استيراد الصالونات من ملف Excel
                </DialogTitle>
                <DialogDescription className="text-xs">
                  أضف دفعة صالونات من ملف الإكسيل ووزّعها على فريق المبيعات بنقرة واحدة
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="gap-1.5 rounded-xl text-xs"
            >
              <Download className="size-3.5" />
              تنزيل نموذج فارغ
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* File Picker Area */}
          {!file ? (
            <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 p-8 text-center transition-colors hover:border-primary/50">
              <UploadCloud className="size-12 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">اسحب وأفلت ملف Excel هنا أو اضغط للاختيار</p>
              <p className="mt-1 text-xs text-muted-foreground">يدعم ملفات .xlsx و .xls و .csv</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <FileSpreadsheet className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    تم استخراج {parsedRows.length} صالون جاهز
                  </p>
                </div>
              </div>
              {!isImporting && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="rounded-xl text-xs text-muted-foreground hover:text-destructive"
                >
                  تغيير الملف
                </Button>
              )}
            </div>
          )}

          {/* Distribution on Sales Team Options */}
          {parsedRows.length > 0 && !importSummary && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <h4 className="text-sm font-bold">توزيع الصالونات على فريق المبيعات:</h4>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setDistributionMode("unassigned")}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-start transition-all ${
                    distributionMode === "unassigned"
                      ? "border-primary bg-primary/5 font-semibold text-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="text-xs font-bold">بدون تعيين (غير مخصص)</span>
                  <span className="text-[11px] text-muted-foreground">
                    تُترك مفتوحة ليختار كل موظف صالوناته لاحقاً
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionMode("round-robin")}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-start transition-all ${
                    distributionMode === "round-robin"
                      ? "border-primary bg-primary/5 font-semibold text-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="text-xs font-bold">توزيع بالتساوي (تلقائي)</span>
                  <span className="text-[11px] text-muted-foreground">
                    تقسيم الصالونات أوتوماتيكياً على المناديب
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionMode("single")}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-start transition-all ${
                    distributionMode === "single"
                      ? "border-primary bg-primary/5 font-semibold text-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="text-xs font-bold">تعيين لمسؤول محدد</span>
                  <span className="text-[11px] text-muted-foreground">
                    إسناد الدفعة كاملة لشخص واحد
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionMode("excel")}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-start transition-all ${
                    distributionMode === "excel"
                      ? "border-primary bg-primary/5 font-semibold text-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="text-xs font-bold">من ملف Excel</span>
                  <span className="text-[11px] text-muted-foreground">
                    حسب عمود «المسؤول عن المتابعة»
                  </span>
                </button>
              </div>

              {distributionMode === "single" && (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs">اختر مسؤول المبيعات للدفعة:</Label>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="اختر الموظف" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.role === "admin" ? "مدير" : "مندوب مبيعات"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Preview Table of First 3 Salons */}
          {parsedRows.length > 0 && !importSummary && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>معاينة لأول {Math.min(parsedRows.length, 3)} صالونات:</span>
                <span>الإجمالي: {parsedRows.length}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-end text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-2.5">اسم الصالون</th>
                      <th className="p-2.5">المدينة</th>
                      <th className="p-2.5">رقم الهاتف</th>
                      <th className="p-2.5">النشاط</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedRows.slice(0, 3).map((r, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="p-2.5 font-semibold">{r.name}</td>
                        <td className="p-2.5 text-muted-foreground">{r.city}</td>
                        <td className="p-2.5 dir-ltr font-mono text-muted-foreground">
                          {r.phone || "—"}
                        </td>
                        <td className="p-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {r.business_type}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Bar during import */}
          {isImporting && (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-center">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-primary">جارٍ استيراد وتوزيع الصالونات...</span>
                <span className="font-bold">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2.5 rounded-full" />
            </div>
          )}

          {/* Success Summary */}
          {importSummary && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
              <CheckCircle2 className="size-12 text-emerald-500" />
              <h3 className="mt-3 text-lg font-bold">اكتمل الاستيراد والتوزيع بنجاح!</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                تمت إضافة <span className="font-bold text-emerald-600">{importSummary.success}</span> صالون إلى قاعدة البيانات وتوزيعهم على الفريق.
              </p>
              {importSummary.failed > 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  تعذر استيراد {importSummary.failed} صفوف لوجود أخطاء في البيانات.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!importSummary ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isImporting}
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={isImporting || parsedRows.length === 0}
                onClick={handleStartImport}
                className="gap-2 rounded-xl"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    جارٍ الاستيراد ({progress}%)
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="size-4" />
                    بدء الاستيراد ({parsedRows.length} صالون)
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-xl"
            >
              إغلاق
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
