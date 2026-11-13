import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    // Must come before react() — generates routeTree.gen.ts from src/routes/
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Listen on all interfaces so the VPS can reach it behind a reverse proxy.
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      // Forward PocketBase API + realtime to the local PocketBase instance.
      "/api": {
        target: process.env["VITE_PB_URL"] || "http://127.0.0.1:8090",
        changeOrigin: true,
      },
      "/_": {
        target: process.env["VITE_PB_URL"] || "http://127.0.0.1:8090",
        changeOrigin: true,
      },
    },
  },
});
