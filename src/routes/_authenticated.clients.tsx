import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  Filter,
  MessageSquare,
  Phone,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useClients } from "@/hooks/use-crm";
import { LogContactDialog } from "@/components/clients/log-contact-dialog";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientSheet } from "@/components/clients/client-sheet";
import {
  BUSINESS_TYPES,
  CITIES,
  CONTACT_STATUSES,
  OUTCOMES,
  PRIORITIES,
} from "@/lib/constants";
import { buildWhatsAppUrl, formatArabicDate } from "@/lib/utils";
import type { Client } from "@/lib/types";

interface ClientsSearchParams {
  q?: string | undefined;
  city?: string | undefined;
  business_type?: string | undefined;
  priority?: string | undefined;
  status?: string | undefined;
  outcome?: string | undefined;
  page?: number | undefined;
}

export const Route = createFileRoute("/_authenticated/clients")({
  validateSearch: (search: Record<string, unknown>): ClientsSearchParams => {
    return {
      q: (search["q"] as string) || undefined,
      city: (search["city"] as string) || undefined,
      business_type: (search["business_type"] as string) || undefined,
      priority: (search["priority"] as string) || undefined,
      status: (search["status"] as string) || undefined,
      outcome: (search["outcome"] as string) || undefined,
      page: Number(search["page"]) > 0 ? Number(search["page"]) : 1,
    };
  },
  component: ClientsPage,
});

function ClientsPage() {
  const navigate = Route.useNavigate();
  const searchParams = Route.useSearch();
  const authContext = Route.useRouteContext() as any;
  const isAdmin = authContext?.user?.role === "admin";

  const q = searchParams.q ?? "";
  const city = searchParams.city ?? "الكل";
  const businessType = searchParams.business_type ?? "الكل";
  const priority = searchParams.priority ?? "الكل";
  const status = searchParams.status ?? "الكل";
  const outcome = searchParams.outcome ?? "الكل";
  const page = searchParams.page ?? 1;

  // Dialog & Sheet States
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const { data, isLoading } = useClients({
    page,
    perPage: 15,
    search: q,
    city: city === "الكل" ? undefined : city,
    business_type: businessType === "الكل" ? undefined : businessType,
    priority: priority === "الكل" ? undefined : priority,
    contact_status: status === "الكل" ? undefined : status,
    outcome: outcome === "الكل" ? undefined : outcome,
  });

  const clients = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalItems = data?.totalItems ?? 0;

  const updateSearch = (newParams: Partial<ClientsSearchParams>) => {
    navigate({
      search: (prev: ClientsSearchParams): ClientsSearchParams => {
        const next: ClientsSearchParams = { ...prev, ...newParams };
        if (
          newParams.q !== undefined ||
          newParams.city !== undefined ||
          newParams.status !== undefined ||
          newParams.outcome !== undefined
        ) {
          next.page = 1;
        }
        return next;
      },
    });
  };

  const handleResetFilters = () => {
    navigate({
      search: (): ClientsSearchParams => ({ page: 1 }),
    });
  };

  const handleOpenLog = (client: Client) => {
    setSelectedClient(client);
    setLogDialogOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setSelectedClient(client);
    setFormDialogOpen(true);
  };

  const handleOpenSheet = (client: Client) => {
    setSelectedClient(client);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">العملاء والصالونات</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            إدارة قاعدة بيانات الصالونات، متابعة الحالات، وتحديث السجلات ({totalItems} صالون)
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedClient(null);
            setFormDialogOpen(true);
          }}
          className="h-10 gap-2 rounded-xl shadow-xs"
        >
          <Plus className="size-4" />
          إضافة صالون جديد
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        {/* Search input */}
        <div className="relative">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => updateSearch({ q: e.target.value })}
            placeholder="ابحث باسم الصالون، الكود، أو رقم الهاتف..."
            className="h-10 rounded-xl bg-background pe-10 text-sm"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {/* City */}
          <Select value={city} onValueChange={(val) => updateSearch({ city: val })}>
            <SelectTrigger className="h-9 rounded-xl text-xs text-start">
              <SelectValue placeholder="المدينة" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="الكل">كل المدن</SelectItem>
              {CITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Business Type */}
          <Select
            value={businessType}
            onValueChange={(val) => updateSearch({ business_type: val })}
          >
            <SelectTrigger className="h-9 rounded-xl text-xs text-start">
              <SelectValue placeholder="نوع النشاط" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="الكل">كل الأنشطة</SelectItem>
              {BUSINESS_TYPES.map((bt) => (
                <SelectItem key={bt} value={bt}>
                  {bt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={status} onValueChange={(val) => updateSearch({ status: val })}>
            <SelectTrigger className="h-9 rounded-xl text-xs text-start">
              <SelectValue placeholder="حالة التواصل" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="الكل">كل الحالات</SelectItem>
              {CONTACT_STATUSES.map((cs) => (
                <SelectItem key={cs} value={cs}>
                  {cs}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Outcome */}
          <Select value={outcome} onValueChange={(val) => updateSearch({ outcome: val })}>
            <SelectTrigger className="h-9 rounded-xl text-xs text-start">
              <SelectValue placeholder="النتيجة" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="الكل">كل النتائج</SelectItem>
              {OUTCOMES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority */}
          <Select value={priority} onValueChange={(val) => updateSearch({ priority: val })}>
            <SelectTrigger className="h-9 rounded-xl text-xs text-start">
              <SelectValue placeholder="الأولوية" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="الكل">كل الأولويات</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

      {/* Clients Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <Table dir="rtl">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-start">كود واسم الصالون</TableHead>
              <TableHead className="text-start">المدينة والنوع</TableHead>
              <TableHead className="text-start">رقم التواصل</TableHead>
              <TableHead className="text-start">حالة التواصل</TableHead>
              <TableHead className="text-start">النتيجة</TableHead>
              <TableHead className="text-start">الأولوية</TableHead>
              <TableHead className="text-start">المتابعة القادمة</TableHead>
              <TableHead className="text-end">الإجراءات</TableHead>
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
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Building2 className="size-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      لا يوجد عملاء يطابقون خيارات البحث
                    </p>
                    <p className="text-xs text-muted-foreground">
                      جرّب تعديل الفلاتر أو إضافة صالون جديد.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => {
                const waUrl = buildWhatsAppUrl(
                  client.phone,
                  `مرحبًا ${client.name}، نتواصل معكم من OJLinker.`
                );
                return (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() => handleOpenSheet(client)}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <span className="font-bold text-foreground hover:text-primary">
                          {client.name}
                        </span>
                        <p className="font-mono text-xs text-muted-foreground">{client.code}</p>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {client.city} · {client.business_type}
                    </TableCell>

                    <TableCell className="font-mono text-xs text-foreground" dir="ltr">
                      {client.phone}
                    </TableCell>

                    <TableCell>
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                        {client.contact_status}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                        {client.outcome}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={client.priority === "عالية" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {client.priority}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {client.next_follow_up_date || "—"}
                    </TableCell>

                    <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex size-8 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-500/10"
                          title="محادثة واتساب"
                        >
                          <MessageSquare className="size-4" />
                        </a>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-primary hover:bg-primary/10"
                          onClick={() => handleOpenLog(client)}
                          title="تسجيل تواصل"
                        >
                          <Plus className="size-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(client)}
                          title="تعديل الصالون"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenSheet(client)}
                          title="عرض التفاصيل"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <span className="text-muted-foreground">
              الصفحة {page} من {totalPages} ({totalItems} صالون)
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

      {/* Dialogs & Sheet */}
      <LogContactDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        client={selectedClient}
      />

      <ClientFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        client={selectedClient}
      />

      <ClientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        client={selectedClient}
        onEdit={(c) => {
          setSheetOpen(false);
          handleOpenEdit(c);
        }}
        onLogContact={(c) => {
          setSheetOpen(false);
          handleOpenLog(c);
        }}
        isAdmin={isAdmin}
      />
    </div>
  );
}
