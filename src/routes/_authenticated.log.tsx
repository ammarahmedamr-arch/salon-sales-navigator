import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useLogs } from "@/hooks/use-crm";
import { LogContactDialog } from "@/components/clients/log-contact-dialog";
import { CHANNELS, CONTACT_RESULTS, REPLIED_OPTIONS } from "@/lib/constants";
import { formatArabicDate } from "@/lib/utils";

interface LogSearchParams {
  search?: string | undefined;
  channel?: string | undefined;
  result?: string | undefined;
  replied?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
}

export const Route = createFileRoute("/_authenticated/log")({
  validateSearch: (search: Record<string, unknown>): LogSearchParams => {
    return {
      search: (search["search"] as string) || undefined,
      channel: (search["channel"] as string) || undefined,
      result: (search["result"] as string) || undefined,
      replied: (search["replied"] as string) || undefined,
      dateFrom: (search["dateFrom"] as string) || undefined,
      dateTo: (search["dateTo"] as string) || undefined,
      page: Number(search["page"]) > 0 ? Number(search["page"]) : 1,
    };
  },
  component: ContactLogsPage,
});

function ContactLogsPage() {
  const navigate = Route.useNavigate();
  const searchParams = Route.useSearch();

  const search = searchParams.search ?? "";
  const channel = searchParams.channel ?? "الكل";
  const result = searchParams.result ?? "الكل";
  const replied = searchParams.replied ?? "الكل";
  const dateFrom = searchParams.dateFrom ?? "";
  const dateTo = searchParams.dateTo ?? "";
  const page = searchParams.page ?? 1;

  const [logDialogOpen, setLogDialogOpen] = useState(false);

  const { data, isLoading } = useLogs({
    page,
    perPage: 20,
    search: search || undefined,
    channel: channel === "الكل" ? undefined : channel,
    result: result === "الكل" ? undefined : result,
    replied: replied === "الكل" ? undefined : replied,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const logs = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalItems = data?.totalItems ?? 0;

  const updateSearch = (newParams: Partial<LogSearchParams>) => {
    navigate({
      search: (prev: LogSearchParams): LogSearchParams => {
        const next: LogSearchParams = { ...prev, ...newParams };
        if (
          newParams.search !== undefined ||
          newParams.channel !== undefined ||
          newParams.result !== undefined ||
          newParams.replied !== undefined
        ) {
          next.page = 1;
        }
        return next;
      },
    });
  };

  const handleResetFilters = () => {
    navigate({
      search: (): LogSearchParams => ({ page: 1 }),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">سجل التواصل</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            أرشيف ومتابعة لجميع محاولات التواصل مع الصالونات ({totalItems} عملية تواصل)
          </p>
        </div>
        <Button
          onClick={() => setLogDialogOpen(true)}
          className="h-10 gap-2 rounded-xl shadow-xs"
        >
          <Plus className="size-4" />
          تسجيل تواصل جديد
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => updateSearch({ search: e.target.value })}
            placeholder="ابحث برقم الكود، ملخص الرد، أو اسم الصالون..."
            className="h-10 rounded-xl bg-background pe-10 text-sm"
          />
        </div>

        {/* Filter dropdowns and dates */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {/* Channel */}
          <Select value={channel} onValueChange={(val) => updateSearch({ channel: val })}>
            <SelectTrigger className="h-9 rounded-xl text-xs text-start">
              <SelectValue placeholder="القناة" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="الكل">كل القنوات</SelectItem>
              {CHANNELS.map((ch) => (
                <SelectItem key={ch} value={ch}>
                  {ch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Result */}
          <Select value={result} onValueChange={(val) => updateSearch({ result: val })}>
            <SelectTrigger className="h-9 rounded-xl text-xs text-start">
              <SelectValue placeholder="النتيجة" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="الكل">كل النتائج</SelectItem>
              {CONTACT_RESULTS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Replied */}
          <Select value={replied} onValueChange={(val) => updateSearch({ replied: val })}>
            <SelectTrigger className="h-9 rounded-xl text-xs text-start">
              <SelectValue placeholder="رد الصالون" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="الكل">رد الصالون: الكل</SelectItem>
              {REPLIED_OPTIONS.map((ro) => (
                <SelectItem key={ro} value={ro}>
                  {ro}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date From */}
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => updateSearch({ dateFrom: e.target.value })}
            className="h-9 rounded-xl bg-background text-xs"
            placeholder="من تاريخ"
            title="من تاريخ"
          />

          {/* Date To */}
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => updateSearch({ dateTo: e.target.value })}
            className="h-9 rounded-xl bg-background text-xs"
            placeholder="إلى تاريخ"
            title="إلى تاريخ"
          />

          {/* Reset Filters */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="h-9 gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            إعادة ضبط
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <Table dir="rtl">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-start">تاريخ ووقت التواصل</TableHead>
              <TableHead className="text-start">الصالون</TableHead>
              <TableHead className="text-start">القناة</TableHead>
              <TableHead className="text-start">نوع المحاولة</TableHead>
              <TableHead className="text-start">رد الصالون</TableHead>
              <TableHead className="text-start">النتيجة</TableHead>
              <TableHead className="text-start">ملخص الرد والملاحظات</TableHead>
              <TableHead className="text-start">الإجراء القادم</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-8 w-full rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Activity className="size-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      لا توجد سجلات تواصل مطابقة
                    </p>
                    <p className="text-xs text-muted-foreground">
                      جرّب تعديل الفلاتر أو تسجيل تواصل جديد.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="transition-colors hover:bg-muted/40">
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground">
                        {formatArabicDate(log.contacted_at)}
                      </span>
                      <p className="font-mono text-[10px] text-muted-foreground">{log.code}</p>
                    </div>
                  </TableCell>

                  <TableCell className="font-medium text-xs">
                    {log.client ? (
                      <div>
                        <span className="font-bold text-foreground">{log.client.name}</span>
                        <p className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                          {log.client.phone}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {log.channel}
                    </span>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {log.attempt_type}
                  </TableCell>

                  <TableCell className="text-xs">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        log.replied === "نعم"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : log.replied === "لا"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {log.replied}
                    </span>
                  </TableCell>

                  <TableCell className="text-xs">
                    <span className="rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      {log.result}
                    </span>
                  </TableCell>

                  <TableCell className="max-w-xs text-xs text-foreground/90">
                    <p className="line-clamp-2 leading-relaxed">
                      {log.reply_summary || "—"}
                    </p>
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {log.next_action !== "لا إجراء" ? (
                      <span className="font-medium text-primary">{log.next_action}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <span className="text-muted-foreground">
              الصفحة {page} من {totalPages} ({totalItems} عملية تواصل)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateSearch({ page: page - 1 })}
                className="h-8 rounded-lg gap-1 px-2.5"
              >
                <ChevronRight className="size-3.5" />
                السابق
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateSearch({ page: page + 1 })}
                className="h-8 rounded-lg gap-1 px-2.5"
              >
                التالي
                <ChevronLeft className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Log Contact Dialog */}
      <LogContactDialog open={logDialogOpen} onOpenChange={setLogDialogOpen} />
    </div>
  );
}
