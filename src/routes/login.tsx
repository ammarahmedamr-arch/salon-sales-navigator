import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Command, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول | OJLinker CRM" }, { name: "description", content: "تسجيل الدخول إلى منصة متابعة مبيعات الصالونات OJLinker." }, { property: "og:title", content: "تسجيل الدخول | OJLinker CRM" }, { property: "og:description", content: "إدارة العملاء ومتابعات فريق المبيعات." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: LoginPage,
});
function LoginPage() {
  const navigate = useNavigate(); const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [visible, setVisible] = useState(false); const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setPending(true); try { await api.auth.login(email, password); await router.invalidate(); await navigate({ to: "/", replace: true }); toast.success("أهلًا بك في OJLinker"); } catch { toast.error("تعذّر تسجيل الدخول"); } finally { setPending(false); } };
  return <main className="login-screen"><div className="login-decoration login-decoration-one" /><div className="login-decoration login-decoration-two" />
    <div className="login-card"><div className="login-mark"><div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Command className="size-6" /></div><div><span className="text-xl font-bold">OJLinker</span><p className="mt-0.5 text-xs text-muted-foreground">متابعة مبيعات الصالونات</p></div></div>
      <div className="mt-10"><div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Sparkles className="size-5" /></div><h1 className="mt-5 text-2xl font-bold">مرحبًا بعودتك</h1><p className="mt-2 text-sm leading-7 text-muted-foreground">سجّل دخولك لمتابعة عملائك وإنجاز مهام اليوم.</p></div>
      <form onSubmit={submit} className="mt-7 space-y-5"><div className="space-y-2"><Label htmlFor="email">البريد الإلكتروني</Label><div className="relative"><Mail className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" dir="ltr" className="h-11 rounded-xl pe-10 text-start" /></div></div><div className="space-y-2"><Label htmlFor="password">كلمة المرور</Label><div className="relative"><LockKeyhole className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="password" type={visible ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" dir="ltr" className="h-11 rounded-xl pe-10 ps-11 text-start" /><Button type="button" variant="ghost" size="icon" onClick={() => setVisible(!visible)} className="absolute start-1 top-1 size-9" aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{visible ? <EyeOff /> : <Eye />}</Button></div></div><Button type="submit" className="h-11 w-full rounded-xl" disabled={pending}>{pending ? "جارٍ الدخول..." : "تسجيل الدخول"}</Button></form>
      <div className="mt-7 flex items-center justify-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" />مساحة عمل خاصة بفريق المبيعات</div>
    </div><p className="absolute inset-x-0 bottom-6 text-center text-xs text-muted-foreground">OJLinker · إدارة علاقات العملاء</p>
  </main>;
}
