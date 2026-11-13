import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ThemeContextValue = { dark: boolean; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

if (window.localStorage.getItem("ojlinker_theme") === "dark") {
  document.documentElement.classList.add("dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const value = useMemo(
    () => ({
      dark,
      toggleTheme: () =>
        setDark((current) => {
          const next = !current;
          window.localStorage.setItem("ojlinker_theme", next ? "dark" : "light");
          return next;
        }),
    }),
    [],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeProvider is missing");
  return context;
}
