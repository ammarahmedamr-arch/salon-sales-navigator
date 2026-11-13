import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { routeTree } from "./routeTree.gen";
import "@/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min
      retry: 1,
    },
  },
});

function AppToaster() {
  const { dark } = useTheme();
  return <Toaster position="top-center" richColors dir="rtl" theme={dark ? "dark" : "light"} />;
}

const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

// Register the router type for useNavigate / Link type-safety throughout the app.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Could not find #root element");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
        <AppToaster />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
