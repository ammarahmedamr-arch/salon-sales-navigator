import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, Lock, Mail, Shield, Trash2, User, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateUser, useDeleteUser, useUpdateUser } from "@/hooks/use-crm";
import type { AppUser } from "@/lib/types";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: AppUser | null;
  currentUser?: AppUser | null;
  onSuccess?: () => void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  currentUser,
  onSuccess,
}: UserFormDialogProps) {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const isEditing = Boolean(user);
  const isSelf = currentUser && user && currentUser.id === user.id;
  const isViewerAdmin = currentUser ? currentUser.role === "admin" : true;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (user) {
        setName(user.name || "");
        setEmail(user.email || "");
        setRole(user.role || "agent");
        setPassword("");
      } else {
        setName("");
        setEmail("");
        setPassword("");
        setRole("agent");
      }
      setConfirmDelete(false);
    }
  }, [open, user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("يرجى إدخال اسم الموظف");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      toast.error("يرجى إدخال بريد إلكتروني صحيح");
      return;
    }

    if (!isEditing && (!password || password.length < 8)) {
      toast.error("كلمة المرور يجب أن لا تقل عن 8 أحرف");
      return;
    }

    if (isEditing && password && password.length < 8) {
      toast.error("كلمة المرور الجديدة يجب أن لا تقل عن 8 أحرف");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && user) {
        await updateUser.mutateAsync({
          id: user.id,
          input: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            ...(password ? { password: password.trim() } : {}),
          },
        });
        toast.success(`تم تحديث بيانات الموظف ${name} بنجاح`);
      } else {
        await createUser.mutateAsync({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          role,
        });
        toast.success(`تمت إضافة الموظف ${name} بنجاح`);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "تعذر حفظ بيانات الموظف");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteUser.mutateAsync(user.id);
      toast.success(`تم حذف الموظف ${user.name} بنجاح`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "تعذر حذف الموظف");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <User className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {isEditing ? `تعديل بيانات ${user?.name}` : "إضافة موظف جديد"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isEditing
                  ? "تعديل الاسم والبريد والدور أو تعيين كلمة مرور جديدة"
                  : "إنشاء حساب جديد لمسؤول مبيعات أو مدير"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="user-name" className="text-xs font-semibold">
              اسم الموظف *
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: محمد سيد"
                className="h-10 rounded-xl pe-9 text-xs"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="user-email" className="text-xs font-semibold">
              البريد الإلكتروني (اسم المستخدم) *
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mohamed@ojlinker.com.sa"
                className="h-10 rounded-xl pe-9 font-mono text-xs"
                dir="ltr"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="user-password" className="text-xs font-semibold">
              {isEditing ? "كلمة المرور الجديدة (اختياري — اتركها فارغة إذا لم ترغب بالتغيير)" : "كلمة المرور * (8 أحرف فأكثر)"}
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="user-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEditing ? "اتركها فارغة لعدم التغيير" : "كلمة المرور (مثال: AgentPass123!)"}
                className="h-10 rounded-xl pe-9 font-mono text-xs"
                dir="ltr"
                required={!isEditing}
              />
            </div>
          </div>

          {/* Role */}
          {isViewerAdmin ? (
            <div className="space-y-1.5">
              <Label htmlFor="user-role" className="text-xs font-semibold">
                الدور والصلاحية *
              </Label>
              <Select value={role} onValueChange={(val) => setRole(val as "admin" | "agent")}>
                <SelectTrigger id="user-role" className="h-10 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="agent">مسؤول مبيعات (متابعة الصالونات وتسجيل التواصل)</SelectItem>
                  <SelectItem value="admin">مدير نظام (تحكم كامل + حذف الصالونات والمستخدمين)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الدور والصلاحية</Label>
              <div className="rounded-xl border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                مسؤول مبيعات (متابعة الصالونات وتسجيل التواصل)
              </div>
            </div>
          )}

          <DialogFooter className="flex-row items-center justify-between gap-2 pt-2 sm:justify-between">
            {isEditing && isViewerAdmin && !isSelf && (
              <Button
                type="button"
                variant={confirmDelete ? "destructive" : "ghost"}
                size="sm"
                disabled={isSubmitting}
                onClick={handleDelete}
                className="gap-1.5 rounded-xl text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                {confirmDelete ? "تأكيد الحذف نهائيًا؟" : "حذف الموظف"}
              </Button>
            )}

            <div className="flex items-center gap-2 ms-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="gap-1.5 rounded-xl text-xs font-semibold"
              >
                <UserCheck className="size-3.5" />
                {isEditing ? "حفظ التعديلات" : "إضافة الموظف"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
