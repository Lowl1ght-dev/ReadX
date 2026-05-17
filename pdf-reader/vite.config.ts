import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "strip-crossorigin-for-electron",
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin(="[^"]*")?/g, "");
      },
    },
  ],
  base: "./",
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/pdfjs-dist") || id.includes("node_modules/react-pdf")) {
            return "pdf";
          }
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  server: {
    port: 5173,
    /** если 5173 занят (старый dev-сервер), Vite возьмёт 5174, 5175, … */
    strictPort: false,
  },
});
