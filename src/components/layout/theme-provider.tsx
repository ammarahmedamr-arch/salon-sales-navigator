import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ThemeContextValue = { dark: boolean; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(window.localStorage.getItem("ojlinker_theme") === "dark"); }, []);
  const value = useMemo(() => ({ dark, toggleTheme: () => setDark((current) => { const next = !current; window.localStorage.setItem("ojlinker_theme", next ? "dark" : "light"); return next; }) }), []);
  return <ThemeContext.Provider value={value}><div className={dark ? "dark min-h-screen" : "min-h-screen"}>{children}</div></ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeProvider is missing");
  return context;
}
