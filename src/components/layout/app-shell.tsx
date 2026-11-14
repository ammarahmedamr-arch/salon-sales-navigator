import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Activity, ArrowUpRight, Bell, ChevronDown, Command, LayoutDashboard, LogOut, Menu, Moon, Search, Settings, Sun, UsersRound, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClients, useCrmRealtime, useTeamUsers } from "@/hooks/use-crm";
import { api } from "@/lib/api";
import { computeFollowUpState } from "@/lib/utils";
import type { AppUser } from "@/lib/types";
import { useTheme } from "./theme-provider";

const navigation = [
  { to: "/" as const, label: "لوحة المتابعة", icon: LayoutDashboard },
  { to: "/today" as const, label: "متابعات اليوم", icon: Bell },
  { to: "/clients" as const, label: "العملاء", icon: UsersRound },
  { to: "/log" as const, label: "سجل التواصل", icon: Activity },
  { to: "/settings" as const, label: "الإعدادات", icon: Settings },
];
export function AppShell({ user }: { user: AppUser }) {
  useCrmRealtime();
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const { dark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [search, setSearch] = useState("");
  const clients = useClients({ perPage: 1000 });
  const users = useTeamUsers();
  const activeUsers = users.data?.length ?? 4;
  const clientRows = clients.data?.items ?? [];
  const dueCount = clientRows.filter((client) => {
    if (user.role !== "admin") {
      if (client.owner !== user.id && client.owner !== user.name) return false;
    }
    const state = computeFollowUpState(client.next_follow_up_date, client.outcome);
    return state === "متأخرة" || state === "مستحقة";
  }).length;
  const filteredSearch = search.trim();
  useEffect(() => {
    if (!filteredSearch) return;
    const timer = window.setTimeout(() => navigate({ to: "/clients", search: { q: filteredSearch } }), 220);
    return () => window.clearTimeout(timer);
  }, [filteredSearch, navigate]);
  const signOut = async () => { await api.auth.logout(); await router.invalidate(); toast.success("تم تسجيل الخروج"); await navigate({ to: "/login", replace: true }); };
  const SidebarContents = () => <>
    <Link to="/" className="flex items-center gap-3 px-5 py-5" aria-label="الرئيسية OJLinker">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Command className="size-5" /></div>
      {!collapsed && <div className="min-w-0"><p className="font-bold tracking-normal text-foreground">OJLinker</p><p className="mt-0.5 text-xs text-muted-foreground">متابعة مبيعات الصالونات</p></div>}
    </Link>
    <nav aria-label="التنقل الرئيسي" className="mt-5 flex-1 space-y-1 px-3">
      {!collapsed && <p className="px-3 pb-2 text-[11px] font-semibold uppercase text-muted-foreground">القائمة الرئيسية</p>}
      {navigation.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
        return <Link key={to} to={to} className={`nav-link group ${active ? "nav-link-active" : ""}`} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined}>
          <Icon className="size-[18px] shrink-0" /><span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>{label}</span>
          {to === "/today" && dueCount > 0 && <span className="nav-count">{dueCount}</span>}
        </Link>;
      })}
    </nav>
    {!collapsed && <div className="mx-3 mb-3 border-t border-border pt-4">
      {user.role === "admin" ? (
        <div className="flex items-center gap-3 rounded-xl bg-muted/70 px-3 py-3">
          <div className="flex -space-x-2 space-x-reverse">{((users.data && users.data.length > 0) ? users.data : [{ name: user.name, id: "u" }]).slice(0, 3).map((u, index) => <span key={u.id || index} className={`team-dot team-dot-${index}`}>{u.name.slice(0, 1)}</span>)}</div>
          <div className="min-w-0"><p className="text-xs font-semibold">فريق المبيعات</p><p className="mt-0.5 text-[11px] text-muted-foreground">{activeUsers} أعضاء نشطون</p></div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-muted/70 px-3 py-3">
          <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{user.name.slice(0, 1)}</div>
          <div className="min-w-0"><p className="text-xs font-semibold">{user.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">مسؤول مبيعات</p></div>
        </div>
      )}
    </div>}
  </>;
  return <div className="app-frame min-h-screen bg-background text-foreground">
    <aside className={`sidebar hidden md:flex ${collapsed ? "sidebar-collapsed" : ""}`}><SidebarContents /><Button variant="ghost" size="icon" aria-label={collapsed ? "توسيع القائمة" : "تصغير القائمة"} title={collapsed ? "توسيع القائمة" : "تصغير القائمة"} onClick={() => setCollapsed(!collapsed)} className="m-3 mt-1"><Menu className="size-4" /></Button></aside>
    <main className={`main-panel ${collapsed ? "main-panel-collapsed" : ""}`}>
      <header className="topbar"><div className="min-w-0 flex-1"><div className="relative max-w-md"><Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="بحث عن عميل" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن عميل أو رقم التواصل..." className="h-10 rounded-xl border-transparent bg-muted/70 pe-10 text-sm shadow-none focus-visible:bg-background" />{!search && <span className="absolute start-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground lg:flex"><Command className="size-3" /> K</span>}</div></div>
        <div className="flex shrink-0 items-center gap-2"><Button variant="ghost" size="icon" title={dark ? "الوضع الفاتح" : "الوضع الداكن"} aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"} onClick={toggleTheme}>{dark ? <Sun /> : <Moon />}</Button><div className="hidden h-8 w-px bg-border sm:block" /><div className="group relative"><Button variant="ghost" className="h-10 gap-2 px-2"><Avatar className="size-8 border border-border"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{user.name.slice(0,1)}</AvatarFallback></Avatar><span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{user.name}</span><ChevronDown className="size-3.5 text-muted-foreground" /></Button><div className="absolute end-0 top-full z-40 hidden w-52 pt-2 group-focus-within:block group-hover:block"><div className="rounded-xl border bg-popover p-2 shadow-lg"><p className="truncate px-3 py-2 text-xs text-muted-foreground">{user.email}</p><Button variant="ghost" className="w-full justify-start gap-2" onClick={signOut}><LogOut className="size-4" />تسجيل الخروج</Button></div></div></div></div>
      </header>
      <div className="page-content"><Outlet /></div>
      <nav className="mobile-tabbar hidden max-md:grid" aria-label="التنقل الرئيسي">{navigation.filter((item) => item.to !== "/settings").map(({ to, label, icon: Icon }) => { const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to); return <Link key={to} to={to} className={`mobile-tab ${active ? "mobile-tab-active" : ""}`}><span className="relative"><Icon className="size-[19px]" />{to === "/today" && dueCount > 0 && <span className="mobile-count">{dueCount}</span>}</span><span>{label === "متابعات اليوم" ? "المتابعات" : label === "لوحة المتابعة" ? "الرئيسية" : label}</span></Link>; })}<Button variant="ghost" className={`mobile-tab ${location.pathname === "/settings" ? "mobile-tab-active" : ""}`} onClick={() => navigate({ to: "/settings" })} aria-label="الإعدادات"><Settings className="size-[19px]" /><span>الإعدادات</span></Button></nav>
    </main>
  </div>;
}
