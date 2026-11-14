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
import { safeNormalizePhone } from "@/lib/utils";
import type { ClientImportResult, ClientImportRow } from "@/lib/types";

/** Rows per request — keeps payloads small and progress smooth. */
const IMPORT_BATCH_SIZE = 200;
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
  const [importSummary, setImportSummary] = useState<ClientImportResult | null>(null);

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

      // Look for sheet named "العملاء" or first sheet that contains data
      let sheetName =
        workbook.SheetNames.find(
          (name) =>
            name.includes("العملاء") ||
            name.includes("صالون") ||
            name.includes("مشاغل") ||
            name.includes("بيانات") ||
            name.toLowerCase().includes("client")
        ) || "";

      if (sheetName) {
        const ws = workbook.Sheets[sheetName];
        if (!ws || XLSX.utils.sheet_to_json(ws).length === 0) {
          sheetName = "";
        }
      }

      if (!sheetName) {
        for (const name of workbook.SheetNames) {
          const ws = workbook.Sheets[name];
          if (ws && XLSX.utils.sheet_to_json(ws).length > 0) {
            sheetName = name;
            break;
          }
        }
      }

      if (!sheetName) {
        sheetName = workbook.SheetNames[0] || "";
      }

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
        // Find column by common aliases (exact then partial match)
        const findVal = (keys: string[]): string => {
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              if (rowKey.trim().toLowerCase() === k.trim().toLowerCase()) {
                const val = String(row[rowKey] ?? "").trim();
                if (val) return val;
              }
            }
          }
          for (const k of keys) {
            for (const rowKey of Object.keys(row)) {
              const cleanRowKey = rowKey.trim().toLowerCase();
              const cleanK = k.trim().toLowerCase();
              if (
                cleanRowKey.includes(cleanK) ||
                (cleanK.length >= 4 && cleanRowKey.length >= 4 && cleanK.includes(cleanRowKey))
              ) {
                const val = String(row[rowKey] ?? "").trim();
                if (val) return val;
              }
            }
          }
          return "";
        };

        const name = findVal([
          "اسم الصالون",
          "الاسم التجاري",
          "اسم المنشأة",
          "اسم المشغل",
          "المشغل",
          "الصالون",
          "اسم المركز",
          "المركز",
          "اسم العميل",
          "اسم النشاط",
          "المنشأة",
          "المحل",
          "اسم المحل",
          "الاسم",
          "name",
          "salon",
          "company",
          "business",
          "client",
        ]);
        if (!name || name === "اسم الصالون" || name === "الاسم التجاري" || name.includes("صف تجريبي")) {
          // Skip header repeats or demo instruction rows
          continue;
        }

        const rawPhone = findVal([
          "رقم واتساب/هاتف",
          "رقم الهاتف",
          "رقم الجوال",
          "الجوال",
          "الهاتف",
          "جوال",
          "هاتف",
          "واتساب",
          "رقم واتساب",
          "رقم التواصل",
          "التواصل",
          "تواصل",
          "رقم الاتصال",
          "الاتصال",
          "موبايل",
          "رقم الموبايل",
          "phone",
          "mobile",
          "tel",
          "whatsapp",
          "contact",
        ]);

        const city = findVal(["المدينة", "city"]) || "الرياض";
        const business_type =
          findVal(["نوع النشاط", "النشاط", "نوع الصالون", "business_type"]) || "صالون نسائي";
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
        المدينة: "الرياض",
        "نوع النشاط": "صالون نسائي",
        "اسم المسؤول": "أم سارة",
        "رقم واتساب/هاتف": "0551234567",
        "رابط الموقع/إنستجرام": "https://instagram.com/beauty_salon",
        "مصدر البيانات": "خرائط Google",
        الأولوية: "عالية",
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

    // Build the full payload first — owner distribution is deterministic per row.
    const payload: ClientImportRow[] = parsedRows.map((row, i) => {
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
            u.email.toLowerCase().includes(row.excelOwnerName?.trim().toLowerCase() || ""),
        );
        ownerId = matched ? matched.id : "";
      }

      return {
        name: row.name,
        phone: row.phone || "",
        city: row.city,
        business_type: row.business_type,
        contact_person: row.contact_person,
        website_url: row.website_url,
        source: row.source || "بحث يدوي",
        priority: row.priority || "متوسطة",
        notes: row.notes,
        owner: ownerId,
      };
    });

    const summary: ClientImportResult = {
      created: 0,
      skippedDuplicates: 0,
      invalid: 0,
      invalidReasons: [],
      failed: 0,
      failedReasons: [],
    };
    setImportSummary({ ...summary });

    try {
      // Send every row, in batches. Duplicates/invalid rows are skipped
      // server-side — never abort the whole import because of one bad row.
      for (let i = 0; i < payload.length; i += IMPORT_BATCH_SIZE) {
        const chunk = payload.slice(i, i + IMPORT_BATCH_SIZE);
        const res = await api.clients.importBatch(chunk);

        summary.created += res.created;
        summary.skippedDuplicates += res.skippedDuplicates;
        summary.invalid += res.invalid;
        summary.invalidReasons.push(...res.invalidReasons);
        summary.failed += res.failed;
        summary.failedReasons.push(...res.failedReasons);

        setImportSummary({ ...summary });
        setProgress(Math.min(100, Math.round(((i + chunk.length) / payload.length) * 100)));
      }

      // Invalidate CRM queries to refresh Dashboard and Clients list
      queryClient.invalidateQueries({ queryKey: crmKeys.clients });
      queryClient.invalidateQueries({ queryKey: crmKeys.stats });
      queryClient.invalidateQueries({ queryKey: crmKeys.recentLogs });

      const skippedText = summary.skippedDuplicates
        ? ` وتم تجاهل ${summary.skippedDuplicates} صالون مكرر`
        : "";
      toast.success(`تم استيراد ${summary.created} صالون جديد بنجاح${skippedText}.`);
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(
        "تعذّر إكمال الاستيراد: " +
          (err?.message || "خطأ غير متوقع") +
          ` — تم استيراد ${summary.created} صالون قبل التوقف.`,
      );
    } finally {
      setIsImporting(false);
      setProgress(100);
    }
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
              <p className="mt-3 text-sm font-semibold">
                اسحب وأفلت ملف Excel هنا أو اضغط للاختيار
              </p>
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
                    {(() => {
                      const noPhone = parsedRows.filter((r) => !safeNormalizePhone(r.phone)).length;
                      return noPhone > 0 ? ` · ${noPhone} بدون رقم صحيح` : "";
                    })()}
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
          {importSummary && !isImporting && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
              <CheckCircle2 className="size-12 text-emerald-500" />
              <h3 className="mt-3 text-lg font-bold">اكتمل الاستيراد!</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                تمت إضافة{" "}
                <span className="font-bold text-emerald-600">{importSummary.created}</span> صالون
                جديد إلى قاعدة البيانات.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
                {importSummary.skippedDuplicates > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-3 py-1 font-semibold text-amber-600">
                    تم تجاهل {importSummary.skippedDuplicates} صالون مكرر
                  </span>
                )}
                {importSummary.invalid > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-3 py-1 font-semibold text-amber-600">
                    {importSummary.invalid} صف بيانات ناقصة (بدون اسم)
                  </span>
                )}
                {importSummary.failed > 0 && (
                  <span className="rounded-full bg-red-500/10 px-3 py-1 font-semibold text-red-600">
                    تعذر استيراد {importSummary.failed} صف
                  </span>
                )}
                {importSummary.created === 0 &&
                  importSummary.skippedDuplicates === 0 &&
                  importSummary.invalid === 0 &&
                  importSummary.failed === 0 && (
                    <span className="text-muted-foreground">
                      لم يتم العثور على صفوف جديدة للاستيراد.
                    </span>
                  )}
              </div>
              {importSummary.failedReasons.length > 0 && (
                <div className="mt-3 max-h-32 w-full space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-3 text-start text-[11px] text-muted-foreground">
                  {importSummary.failedReasons.map((f, i) => (
                    <p key={i}>
                      • {f.name || `صف #${f.index + 1}`}: {f.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!(importSummary && !isImporting) ? (
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
            <Button type="button" onClick={() => onOpenChange(false)} className="w-full rounded-xl">
              إغلاق
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
